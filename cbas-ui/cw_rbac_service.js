/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// Service RBAC, as the Security section administers it. These are the
// analytics engine's own roles and privileges, distinct from the platform
// roles ns_server keeps on Users & Groups.
//
// The engine has no REST API for any of this. Roles, privileges and role
// assignments are created with SQL++ DDL and read back out of the metadata
// datasets the DDL writes to, so this service is two halves: statement
// builders, which are pure and are where every mistake that matters shows up,
// and four reads against Metadata.`Role`, Metadata.`Privilege`,
// Metadata.`AssignedRole` and ns_server's user list.
//
// The builders are exported as plain functions as well as being wired into the
// Angular factory, so a test can assert on the statement without standing up an
// injector.
//
// Nothing here goes through cwQueryService. That service's factory injects
// qwQueryPlanService and qwDialogService, which its own module does not
// declare - they are registered by cbas.js, the workbench's lazily loaded
// module. Depending on it would make this page work only after the Workbench
// tab had been visited, and fail to render at all before that. The page needs
// the query endpoint and a list of keyspaces, both of which are one $http call.

import angular from "angular";

import cwConstantsService from "./cw_constants_service.js";

export default "cwRbacService";

// The five roles the engine creates for itself. They are in Metadata.`Role`
// like any other, distinguished only by their creator, and nothing about them
// may be changed - dropping one is rejected, and so is granting to it.
export const BUILT_IN_ROLE_CREATOR = "@sys";

// How a privilege is written in a statement. The engine's own spelling, which
// is not always the enum name: COPY_TO is two words.
export const PRIVILEGES = {
  SELECT: "SELECT",
  INSERT: "INSERT",
  UPSERT: "UPSERT",
  DELETE: "DELETE",
  CREATE: "CREATE",
  DROP: "DROP",
  ALTER: "ALTER",
  ANALYZE: "ANALYZE",
  EXECUTE: "EXECUTE",
  CONNECT: "CONNECT",
  DISCONNECT: "DISCONNECT",
  COPY_TO: "COPY TO",
  COPY_FROM: "COPY FROM",
  CREATE_COLLECTION: "CREATE COLLECTION",
  CREATE_CATALOG: "CREATE CATALOG",
  DESCRIBE: "DESCRIBE"
};

// What may be said about each kind of object, mirroring ObjectType.getPrivileges
// in the engine. `ddl` privileges are written without ON and cover objects that
// do not exist yet; `object` privileges are written with ON and name objects
// that do.
//
// `targets` lists the target forms the grammar accepts for that object type.
// They are not interchangeable - the parser has a separate production per form,
// and offering one it does not accept produces a statement that fails at the
// server with a syntax error rather than anything a user could act on.
//
//   ANY       no target: every object of this type, now and in future
//   DATABASE  IN DATABASE `db`
//   SCOPE     IN SCOPE `db`.`scope`
//   OBJECT    a fully qualified `db`.`scope`.`name`
//   NAME      a bare `name` (links and catalogs are not scoped)
export const OBJECT_TYPES = [
  {
    key: "COLLECTION",
    label: "Collection",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [PRIVILEGES.SELECT, PRIVILEGES.INSERT, PRIVILEGES.UPSERT, PRIVILEGES.DELETE, PRIVILEGES.ANALYZE],
    ddlTargets: ["ANY", "DATABASE", "SCOPE"],
    objectTargets: ["ANY", "DATABASE", "SCOPE", "OBJECT"]
  },
  {
    key: "VIEW",
    label: "View",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [PRIVILEGES.SELECT],
    ddlTargets: ["ANY", "DATABASE", "SCOPE"],
    objectTargets: ["ANY", "DATABASE", "SCOPE", "OBJECT"]
  },
  {
    key: "DATABASE",
    label: "Database",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [],
    ddlTargets: ["ANY"],
    objectTargets: []
  },
  {
    key: "SCOPE",
    label: "Scope",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [],
    ddlTargets: ["ANY", "DATABASE"],
    objectTargets: []
  },
  {
    key: "LINK",
    label: "Link",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP, PRIVILEGES.ALTER],
    object: [PRIVILEGES.CONNECT, PRIVILEGES.DISCONNECT, PRIVILEGES.COPY_TO, PRIVILEGES.COPY_FROM,
             PRIVILEGES.CREATE_COLLECTION, PRIVILEGES.CREATE_CATALOG, PRIVILEGES.DESCRIBE],
    ddlTargets: ["ANY"],
    objectTargets: ["ANY", "NAME"]
  },
  {
    key: "CATALOG",
    label: "Linked catalog",
    ddl: [PRIVILEGES.DROP],
    object: [PRIVILEGES.CREATE_COLLECTION],
    ddlTargets: ["ANY"],
    objectTargets: ["ANY", "NAME"]
  },
  {
    key: "FUNCTION",
    label: "Function",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [PRIVILEGES.EXECUTE],
    ddlTargets: ["ANY", "DATABASE", "SCOPE"],
    objectTargets: ["ANY", "DATABASE", "SCOPE", "OBJECT"]
  },
  {
    key: "INDEX",
    label: "Index",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [],
    // An index privilege always names the collections it applies to, even when
    // that is "any": the grammar puts ON inside the DDL branch for this one
    // type, so there is no bare `GRANT CREATE INDEX`.
    ddlTargets: ["ANY", "DATABASE", "SCOPE", "OBJECT"],
    objectTargets: []
  },
  {
    key: "SYNONYM",
    label: "Synonym",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [],
    ddlTargets: ["ANY", "DATABASE", "SCOPE"],
    objectTargets: []
  },
  {
    key: "ROLE",
    label: "Role",
    ddl: [PRIVILEGES.CREATE, PRIVILEGES.DROP],
    object: [],
    ddlTargets: ["ANY"],
    objectTargets: []
  }
];

// How each target form reads in the UI. "Every ..." rather than "any ...":
// what the grammar spells ANY is a standing grant that covers objects created
// after it, and users read "any" as "one of".
export const TARGET_LABELS = {
  ANY: "Everywhere",
  DATABASE: "In a database",
  SCOPE: "In a scope",
  OBJECT: "One object",
  NAME: "One object"
};

// Naming a grantee the cluster no longer has is how orphaned rows are cleaned
// up: validateGrantees calls removeUser - which deletes that user's Privilege
// and AssignedRole rows - and only then raises one of these. So a statement
// that comes back with one of them has done the work, and reporting it as a
// failure would be reporting the opposite of what happened.
//
// These are the codes the service reports, not the engine's internal enum
// values: USER_DOES_NOT_EXIST is CBAS137 inside the engine and 24217 on the
// wire, and USER_ROLE_DOES_NOT_EXIST is CBAS141 and 24221. The two are mapped
// in cbas_errormsg/error_map_en.properties, and only the reported one ever
// reaches a client.
// What ns_server's pluggable-UI proxy answers with when there is no analytics
// service behind it: 404 and a plain-text body for a node that is not running
// it, 503 when no compatible node can be found (menelaus_pluggable_ui's
// server_error/2). 502 and 504 are a proxy that reached nobody, and 0 is the
// browser's own "this request never completed".
export const SERVICE_DOWN_STATUSES = [0, 404, 502, 503, 504];

// Whether the service was unreachable, as opposed to having answered and said
// no. The two need telling apart: one is a cluster the administrator should
// come back to, the other is a statement they should reword.
export function isServiceUnavailableError(error) {
  return !!error && error.unavailable === true;
}

// The grantee-scoped purge addresses an account by domain, name and uuid, each
// its own path segment and each encoded: a grantee name may contain anything
// ns_server accepts, '/' included.
export function purgeGranteePath(base, grantee) {
  return [base, encodeURIComponent(String(grantee.domain || "local").toLowerCase()),
          encodeURIComponent(grantee.id), encodeURIComponent(grantee.uuid)].join("/");
}

// The built-in roles, with a name to show and what each one allows.
//
// Every name is prefixed Service. Three of the five would otherwise collide
// with a platform role shown one tab away - ns_server has Data Reader, Data
// Writer and Security Admin - and prefixing only the ones that clash reads as
// an accident rather than a rule.
//
// The engine names them sys_data_admin and so on; that identifier is what a
// GRANT statement takes and is not something to hide, but it is not what a
// table column should lead with either. Descriptions follow BuiltInRole and
// the hierarchy buildBuiltInRoleTree wires up: sys_root contains
// sys_data_admin and sys_security_admin, sys_data_admin contains
// sys_data_reader, and sys_data_reader contains sys_view_reader.
//
// The same map is in the admin console's mn_user_roles_service.js, which shows
// these roles on Users & Groups and cannot import from a pluggable UI. A test
// compares the two so the copies cannot drift apart unnoticed.
export const BUILT_IN_ROLES = {
  sys_root: {
    name: "Service Root",
    includes: ["sys_data_admin", "sys_security_admin"],
    description: "Full control: everything Service Data Admin and Service RBAC Admin allow, " +
      "plus the service's own diagnostic functions, which no other role can run."
  },
  sys_security_admin: {
    name: "Service RBAC Admin",
    description: "Create and drop service roles, and grant and revoke privileges. " +
      "Cannot grant Service Root, which needs a platform role that can manage this " +
      "service, nor Service RBAC Admin, which needs that or Service Root."
  },
  sys_data_admin: {
    name: "Service Data Admin",
    includes: ["sys_data_reader"],
    description: "Create, alter and drop databases, scopes, collections, views, indexes, " +
      "functions, links and catalogs, and write their data. Includes Service Data Reader."
  },
  sys_data_reader: {
    name: "Service Data Reader",
    includes: ["sys_view_reader"],
    description: "Read collections and describe links. Includes Service View Reader."
  },
  sys_view_reader: {
    name: "Service View Reader",
    description: "Read views."
  }
};

// Where a built-in sits among the built-ins. The map above is written from the
// most capable down - sys_root, then the two roles it contains, then the chain
// under sys_data_admin - so its own order is the ranking, and there is no
// second list to keep in step with it. Answers -1 for a role the engine did
// not create.
export function builtInRoleRank(roleName) {
  return Object.keys(BUILT_IN_ROLES).indexOf(roleName);
}

// The roles someone made come first, in alphabetical order; the five the
// engine ships come last, most capable first.
//
// Custom roles lead because they are the ones an administrator is here to
// look at - the built-ins are fixed furniture. Within them there is nothing to
// rank by: a custom role's capability is whatever it was granted, so
// alphabetical is the only order that means anything. Among the built-ins
// alphabetical would put View Reader above Root, which says nothing about what
// they are, so those keep the capability order.
export function compareRoles(a, b) {
  var rankA = builtInRoleRank(a.name);
  var rankB = builtInRoleRank(b.name);

  if ((rankA < 0) !== (rankB < 0)) {
    return rankA < 0 ? -1 : 1;
  }
  if (rankA < 0) {
    return a.name.localeCompare(b.name);
  }
  return rankA - rankB;
}

// What to show in the name column. A role the engine did not create has no
// name but its own, and repeating it in both columns says nothing.
export function roleDisplayName(roleName) {
  var known = BUILT_IN_ROLES[roleName];
  return known ? known.name : "";
}

// The tooltip behind a role. Custom roles have no canned description, so they
// get pointed at the privileges listed under them instead.
// Every role this one contains, transitively. Built-in containment comes from
// the map above because the engine builds it in memory at startup and writes
// no AssignedRole row for it; a role granted to another role does write one,
// so that half is passed in from the metadata.
//
// Without this, sys_root reads as having no privileges at all: it owns not one
// Privilege row, and everything it can do it can do through the two roles it
// contains.
export function rolesIncludedBy(roleName, grantedRoleNamesByRole, seen) {
  seen = seen || {};
  if (seen[roleName]) {
    return [];
  }
  seen[roleName] = true;

  var direct = ((BUILT_IN_ROLES[roleName] || {}).includes || [])
    .concat((grantedRoleNamesByRole && grantedRoleNamesByRole[roleName]) || []);

  return direct.reduce(function (all, name) {
    if (all.indexOf(name) < 0) {
      all.push(name);
    }
    return all.concat(rolesIncludedBy(name, grantedRoleNamesByRole, seen).filter(function (n) {
      return all.indexOf(n) < 0;
    }));
  }, []);
}

export function roleDescription(roleName) {
  var known = BUILT_IN_ROLES[roleName];
  return known ? known.description
    : "A custom role. Its privileges are listed below.";
}

// The service roles that carry the right to administer service RBAC. These two
// names are what the engine itself reads when it decides whether a statement
// may grant anything at all, so a holder of either administers this page's
// subject matter without needing any platform role beyond the one that lets
// them reach the service.
export const ADMIN_SERVICE_ROLES = ["sys_root", "sys_security_admin"];

// Whether holding roleNames amounts to that, following role-to-role grants: a
// custom role that was granted sys_security_admin carries it exactly as the
// built-in does, and so does anything holding that custom role.
export function holdsAdminServiceRole(roleNames, grantedRoleNamesByRole) {
  return (roleNames || []).some(function (name) {
    return isAdminServiceRole(name) ||
      rolesIncludedBy(name, grantedRoleNamesByRole).some(isAdminServiceRole);
  });
}

function isAdminServiceRole(roleName) {
  return ADMIN_SERVICE_ROLES.indexOf(roleName) >= 0;
}

export function objectTypeByKey(key) {
  return OBJECT_TYPES.filter(function (type) { return type.key === key; })[0];
}

// The privileges offered for an object type, tagged with the form they take.
// CREATE on a collection and SELECT on a collection are both "collection
// privileges" to a user, but they build different statements, so the tag has to
// travel with the choice rather than being re-derived later.
export function privilegesFor(objectTypeKey) {
  var type = objectTypeByKey(objectTypeKey);
  if (!type) {
    return [];
  }
  return type.ddl.map(function (privilege) {
    return {privilege: privilege, ddl: true, label: privilege};
  }).concat(type.object.map(function (privilege) {
    return {privilege: privilege, ddl: false, label: privilege};
  }));
}

export function targetsFor(objectTypeKey, isDdl) {
  var type = objectTypeByKey(objectTypeKey);
  if (!type) {
    return [];
  }
  return isDdl ? type.ddlTargets : type.objectTargets;
}

// A SQL++ delimited identifier. Identifier() accepts a backtick-quoted string
// anywhere it accepts a bare word, so quoting unconditionally is what keeps a
// role called `select` or a database with a dot in its name from parsing as
// something else.
export function quoteId(name) {
  return "`" + String(name == null ? "" : name).replace(/`/g, "``") + "`";
}

function qualified(parts) {
  return parts.filter(function (part) { return part !== undefined && part !== null && part !== ""; })
    .map(quoteId)
    .join(".");
}

// The clause naming what a privilege is on, given the object type, the target
// form and the names the user picked.
//
// `target` carries whichever of database/scope/name the form needs; a function
// also carries an arity, which is part of its identity to the engine and part of
// the name to the parser: test_function(2), not test_function.
export function formatTarget(objectTypeKey, isDdl, targetKind, target) {
  var type = objectTypeByKey(objectTypeKey);
  target = target || {};

  if (!type) {
    throw new Error("unknown object type: " + objectTypeKey);
  }
  if (targetsFor(objectTypeKey, isDdl).indexOf(targetKind) < 0) {
    throw new Error("a " + (isDdl ? "DDL" : "") + " privilege on " + objectTypeKey +
                    " cannot be targeted " + targetKind);
  }

  var scopeClause = "";
  if (targetKind === "DATABASE") {
    scopeClause = " IN DATABASE " + quoteId(target.database);
  } else if (targetKind === "SCOPE") {
    scopeClause = " IN SCOPE " + qualified([target.database, target.scope]);
  }

  // Index is the odd one: the type is named first and the collections it
  // applies to hang off an ON of their own.
  if (objectTypeKey === "INDEX") {
    if (targetKind === "OBJECT") {
      return " INDEX ON COLLECTION " + qualified([target.database, target.scope, target.name]);
    }
    return " INDEX ON ANY COLLECTION" + scopeClause;
  }

  if (isDdl) {
    // No ON at all: the privilege is over objects of this type that do not
    // exist yet, so there is nothing to name.
    return " " + objectTypeKey + scopeClause;
  }

  if (targetKind === "OBJECT") {
    var name = objectTypeKey === "FUNCTION" && target.arity !== undefined && target.arity !== null &&
               String(target.arity) !== ""
      ? qualified([target.database, target.scope, target.name]) + "(" + target.arity + ")"
      : qualified([target.database, target.scope, target.name]);
    return " ON " + objectTypeKey + " " + name;
  }
  if (targetKind === "NAME") {
    return " ON " + objectTypeKey + " " + quoteId(target.name);
  }
  return " ON ANY " + objectTypeKey + scopeClause;
}

// USER and ROLE grantees are spelled differently and an unqualified name means
// a role, so every grantee this UI writes is qualified. An external user has to
// say so: the domain is part of the grantee's identity, and a grant to a local
// user of the same name is a different grant.
export function formatGrantee(grantee) {
  if (grantee.type === "ROLE") {
    return "ROLE " + quoteId(grantee.name);
  }
  var domain = String(grantee.domain || "local").toLowerCase() === "external" ? "EXTERNAL " : "";
  return domain + "USER " + quoteId(grantee.name);
}

function granteeList(grantees) {
  return grantees.map(formatGrantee).join(", ");
}

// CREATE COLLECTION and CREATE CATALOG are read as one privilege only when a
// comma or an ON follows them; with neither, CREATE COLLECTION is the CREATE
// privilege over collections, which is a different grant that happens to parse.
// Both are object privileges, so they always carry an ON - but silently
// building the wrong grant is the one failure mode here with no error to read,
// so the invariant is asserted rather than assumed.
var TWO_WORD_PRIVILEGES = [PRIVILEGES.CREATE_COLLECTION, PRIVILEGES.CREATE_CATALOG];

function privilegeList(privileges, isDdl) {
  if (isDdl) {
    privileges.forEach(function (privilege) {
      if (TWO_WORD_PRIVILEGES.indexOf(privilege) >= 0) {
        throw new Error(privilege + " is a privilege on an object and cannot be granted without one");
      }
    });
  }
  return privileges.join(", ");
}

export function buildCreateRole(roleName) {
  return "CREATE ROLE " + quoteId(roleName);
}

export function buildDropRole(roleName) {
  return "DROP ROLE " + quoteId(roleName);
}

// GRANT and REVOKE differ only in the keyword and the preposition, so they are
// built once: a revoke that does not mirror the grant it undoes leaves a
// privilege behind.
function buildPrivilegeStatement(verb, preposition, spec) {
  if (!spec.privileges || !spec.privileges.length) {
    throw new Error("no privileges to " + verb.toLowerCase());
  }
  if (!spec.grantees || !spec.grantees.length) {
    throw new Error("no grantees to " + verb.toLowerCase() + " " + preposition.toLowerCase());
  }
  return verb + " " + privilegeList(spec.privileges, spec.ddl) +
    formatTarget(spec.objectType, spec.ddl, spec.targetKind, spec.target) +
    " " + preposition + " " + granteeList(spec.grantees);
}

export function buildGrant(spec) {
  return buildPrivilegeStatement("GRANT", "TO", spec);
}

export function buildRevoke(spec) {
  return buildPrivilegeStatement("REVOKE", "FROM", spec);
}

export function buildGrantRoles(roleNames, grantees) {
  return "GRANT ROLE " + roleNames.map(quoteId).join(", ") + " TO " + granteeList(grantees);
}

export function buildRevokeRoles(roleNames, grantees) {
  return "REVOKE ROLE " + roleNames.map(quoteId).join(", ") + " FROM " + granteeList(grantees);
}

// Reconstructs the statement that would undo a row of Metadata.`Privilege`.
// The metadata records the target as the parser resolved it - a database name
// with no scope means IN DATABASE, all three names mean one object - so the
// form is read back off the record rather than remembered.
export function revokeForGrant(row) {
  var target = row.Object || {};
  var objectType = target.ObjectType || row.ObjectType;
  var type = objectTypeByKey(objectType);
  var isDdl = !!type && type.ddl.indexOf(row.Privilege) >= 0 && type.object.indexOf(row.Privilege) < 0;
  var targetKind = targetKindOf(objectType, isDdl, target);

  return buildRevoke({
    privileges: [row.Privilege],
    objectType: objectType,
    ddl: isDdl,
    targetKind: targetKind,
    target: {
      database: target.DatabaseName,
      scope: target.ScopeName,
      name: target.ObjectName
    },
    grantees: [{name: row.Grantee, type: row.GranteeType, domain: row.GranteeDomain}]
  });
}

// Which target form a stored grant was written in. A link or catalog grant
// names its object without a database, so the presence of ObjectName alone is
// what separates "one link" from "every link".
export function targetKindOf(objectTypeKey, isDdl, target) {
  target = target || {};
  var scoped = objectTypeKey !== "LINK" && objectTypeKey !== "CATALOG";

  if (target.ObjectName) {
    return scoped ? "OBJECT" : "NAME";
  }
  if (target.ScopeName) {
    return "SCOPE";
  }
  if (target.DatabaseName) {
    return "DATABASE";
  }
  return "ANY";
}

// How a stored grant reads in the table. Deliberately not the statement: a user
// scanning a role's privileges wants "SELECT on every collection in `db`", not
// DDL they have to parse.
export function describeTarget(row) {
  var target = row.Object || {};
  var objectType = target.ObjectType || row.ObjectType || "";
  var label = (objectTypeByKey(objectType) || {label: objectType || "object"}).label.toLowerCase();

  if (target.ObjectName) {
    var parts = [target.DatabaseName, target.ScopeName, target.ObjectName]
      .filter(function (part) { return !!part; });
    return label + " " + parts.join(".");
  }
  if (target.ScopeName) {
    return "every " + label + " in scope " + target.DatabaseName + "." + target.ScopeName;
  }
  if (target.DatabaseName) {
    return "every " + label + " in database " + target.DatabaseName;
  }
  return "every " + label;
}

angular
  .module("cwRbacService", [cwConstantsService])
  .factory("cwRbacService", ["$q", "$http", "cwConstantsService", cwRbacServiceFactory]);

function cwRbacServiceFactory($q, $http, cwConstantsService) {
  // Ownership is recorded by the engine whenever an object is created, one row
  // per object. It is not something an administrator granted and not something
  // they can revoke, and at a few thousand collections it would be the only
  // thing visible in this page.
  var ROLES_QUERY =
    "SELECT r.RoleName, r.Creator FROM Metadata.`Role` AS r";
  // GranteeUuid and AssigneeId are the account the grant was made to, which is
  // not the same question as the name it was made under: delete a user and
  // create another of that name and the rows still say the old account. The
  // engine compares them the same way when it decides whether a grant applies.
  var PRIVILEGES_QUERY =
    "SELECT p.Grantee, p.GranteeType, p.GranteeDomain, p.GranteeUuid, p.Privilege, p.Grantor, p.`Object` " +
    "FROM Metadata.`Privilege` AS p WHERE p.Privilege != 'OWNERSHIP'";
  var ASSIGNMENTS_QUERY =
    "SELECT a.Assignee, a.AssigneeDomain, a.AssigneeId, a.GranteeType, a.AssignedRoleName " +
    "FROM Metadata.`AssignedRole` AS a";
  // The engine's own view of the cluster's users, gated on its RBAC rather than
  // on the platform's. See getUsers.
  var USERS_QUERY = "SELECT VALUE u FROM users() AS u";
  // Databases and scopes for the grant dialog's pickers. Both halves are read,
  // rather than deriving the databases from the scopes, so that a database
  // with no scopes in it can still be the target of an IN DATABASE grant. The
  // System and Metadata exclusions mirror the workbench's own metadata query.
  var KEYSPACES_QUERY =
    "SELECT db.DatabaseName, NULL AS DataverseName FROM Metadata.`Database` AS db " +
    "WHERE db.DatabaseName != 'System' " +
    "UNION ALL " +
    "SELECT dv.DatabaseName, dv.DataverseName FROM Metadata.`Dataverse` AS dv " +
    "WHERE dv.DataverseName != 'Metadata'";

  var rbacSource = "ui_rbac";

  var service = {
    // reads
    getRoles: getRoles,
    getPrivileges: getPrivileges,
    getAssignments: getAssignments,
    getKeyspaces: getKeyspaces,
    getUsers: getUsers,
    getWhoami: getWhoami,
    // writes
    purgeGrantee: purgeGrantee,
    createRole: createRole,
    dropRole: dropRole,
    grant: grant,
    revoke: revoke,
    grantRoles: grantRoles,
    revokeRoles: revokeRoles,
    execute: execute,
    // pure helpers, re-exported so a controller has one thing to inject
    purgeGranteePath: purgeGranteePath,
    isServiceUnavailableError: isServiceUnavailableError,
    buildCreateRole: buildCreateRole,
    buildDropRole: buildDropRole,
    buildGrant: buildGrant,
    buildRevoke: buildRevoke,
    buildGrantRoles: buildGrantRoles,
    buildRevokeRoles: buildRevokeRoles,
    revokeForGrant: revokeForGrant,
    describeTarget: describeTarget,
    roleDisplayName: roleDisplayName,
    compareRoles: compareRoles,
    rolesIncludedBy: rolesIncludedBy,
    holdsAdminServiceRole: holdsAdminServiceRole,
    roleDescription: roleDescription,
    privilegesFor: privilegesFor,
    targetsFor: targetsFor,
    objectTypeByKey: objectTypeByKey,
    isBuiltInRole: isBuiltInRole,
    OBJECT_TYPES: OBJECT_TYPES,
    TARGET_LABELS: TARGET_LABELS
  };

  return service;

  function isBuiltInRole(role) {
    return !!role && role.Creator === BUILT_IN_ROLE_CREATOR;
  }

  // The service answers a failed statement two ways: a non-2xx, and a 200 whose
  // body carries an errors array. Both have to become the same rejection here
  // or half the failures reach the page as success.
  function execute(statement) {
    return $http({
      url: cwConstantsService.queryURL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ignore-401": "true",
        // Interactive, like the workbench's own metadata reads.
        "Analytics-Priority": "-1"
      },
      data: {statement: statement, source: rbacSource},
      mnHttp: {isNotForm: true, group: "global"}
    })
      .then(function (resp) {
        var errors = resp && resp.data && resp.data.errors;
        if (errors && errors.length) {
          return $q.reject(toError(errors));
        }
        return resp.data;
      }, function (resp) {
        var errors = resp && resp.data && resp.data.errors;
        var error = toError(errors || (resp && resp.data) || resp);
        error.status = resp && resp.status;
        // The service answers a statement it rejected with an errors array. A
        // failed response carrying none did not come from the service at all -
        // the proxy answers a missing analytics node with plain text - so it is
        // a question of the service being there, not of what was asked of it.
        error.unavailable = !errors && SERVICE_DOWN_STATUSES.indexOf(error.status) >= 0;
        return $q.reject(error);
      });
  }

  // The codes travel with the error, not just the text: what a caller does
  // about a failure depends on which one it is, and matching on a message is
  // matching on something nobody promised to keep.
  function toError(errors) {
    var error = new Error(errorText(errors));
    error.codes = errorCodes(errors);
    return error;
  }

  function query(statement) {
    return execute(statement).then(function (data) {
      return (data && data.results) || [];
    });
  }

  function getRoles() {
    return query(ROLES_QUERY);
  }

  function getPrivileges() {
    return query(PRIVILEGES_QUERY);
  }

  function getAssignments() {
    return query(ASSIGNMENTS_QUERY);
  }

  function getKeyspaces() {
    return query(KEYSPACES_QUERY).then(function (rows) {
      var databases = [];
      var scopes = {};
      rows.forEach(function (row) {
        if (!row.DatabaseName) {
          return;
        }
        if (databases.indexOf(row.DatabaseName) < 0) {
          databases.push(row.DatabaseName);
        }
        if (row.DataverseName) {
          scopes[row.DatabaseName] = (scopes[row.DatabaseName] || []).concat(row.DataverseName);
        }
      });
      databases.sort();
      return {databases: databases, scopes: scopes};
    });
  }

  // The cluster's users. Identity is ns_server's, and this page only decides
  // what those users may do here.
  //
  // Two sources for one list, because the obvious one is behind the wrong
  // permission. /settings/rbac/users needs cluster.admin.users!read, which
  // whoever administers this service's RBAC need not hold - sys_root and
  // sys_security_admin carry that right without any platform role beyond the
  // access that reaches the service. The engine publishes the same list as a
  // built-in function gated on those two roles instead, answering it from
  // ns_server under the service's own credentials. So a viewer the platform
  // refuses may still be entitled to the engine's answer, and the fallback is
  // the normal path for them rather than an edge case.
  //
  // The REST endpoint answers a bare array on older clusters and {users: [...]}
  // once it learned to paginate.
  function getUsers() {
    return $http({method: "GET", url: "/settings/rbac/users"}).then(function (resp) {
      var body = resp.data;
      return (angular.isArray(body) ? body : (body && body.users) || []).map(toUser);
    }, function () {
      return query(USERS_QUERY).then(function (rows) {
        return rows.map(toUser);
      });
    });
  }

  // uuid is what makes a grant traceable to an account rather than to a name.
  // ns_server issues one for a local user; for an external user it issues none
  // and there is nothing here to carry - see grantIsStale in the controller.
  function toUser(user) {
    return {id: user.id, domain: user.domain, name: user.name, uuid: user.uuid};
  }

  // Who is looking, from ns_server for the same reason the user list is: the
  // engine records a grantee by the id and domain ns_server gave it, so this
  // is what matches the viewer against the rows this page reads.
  //
  // Answers null rather than failing. Not knowing who the viewer is costs them
  // the actions they might have been allowed, not the page.
  function getWhoami() {
    return $http({method: "GET", url: "/whoami"}).then(function (resp) {
      var body = resp.data || {};
      return body.id ? {id: body.id, domain: body.domain || "local"} : null;
    }, function () {
      return null;
    });
  }

  // Removes every row one account holds, named by the uuid the grants were made
  // to rather than by the name they were made under - which is the whole point:
  // the rows worth purging belong to an account the cluster no longer has, and
  // a live namesake may be holding that name now. The engine answers with a
  // count of what it deleted.
  //
  // This replaces sending a revoke for its side effect. That worked only where
  // no live account held the name: elsewhere the engine resolved the name to
  // that account, revoked a grant it never had, and reported success having
  // removed nothing (MB-73954).
  function purgeGrantee(grantee) {
    return $http({
      method: "DELETE",
      url: purgeGranteePath(cwConstantsService.rbacPurgeURL, grantee),
      headers: {"ignore-401": "true"},
      mnHttp: {isNotForm: true, group: "global"}
    }).then(function (resp) {
      return (resp.data && resp.data.removed) || 0;
    }, function (resp) {
      var error = toError((resp && resp.data && resp.data.errors) || (resp && resp.data) || resp);
      error.status = resp && resp.status;
      return $q.reject(error);
    });
  }

  function createRole(roleName) {
    return execute(buildCreateRole(roleName));
  }

  function dropRole(roleName) {
    return execute(buildDropRole(roleName));
  }

  function grant(spec) {
    return execute(buildGrant(spec));
  }

  function revoke(spec) {
    return execute(buildRevoke(spec));
  }

  function grantRoles(roleNames, grantees) {
    return execute(buildGrantRoles(roleNames, grantees));
  }

  function revokeRoles(roleNames, grantees) {
    return execute(buildRevokeRoles(roleNames, grantees));
  }
}

export function errorCodes(errors) {
  if (!angular.isArray(errors)) {
    errors = [errors];
  }
  return errors
    .map(function (error) { return error && error.code; })
    .filter(function (code) { return code !== undefined && code !== null; });
}

// The engine's errors arrive as {code, msg}; anything else is shown as-is
// rather than as [object Object].
export function errorText(errors) {
  if (!errors) {
    return "The request failed.";
  }
  if (typeof errors === "string") {
    return errors;
  }
  if (angular.isArray(errors)) {
    return errors.map(function (error) {
      return typeof error === "string" ? error : (error.msg || error.message || JSON.stringify(error));
    }).join("; ");
  }
  return errors.msg || errors.message || JSON.stringify(errors);
}

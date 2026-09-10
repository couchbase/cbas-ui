/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The Service RBAC tab of the Security section.
//
// Two tables over one set of reads: service roles with the privileges granted
// to them, and the cluster's users with the roles they hold. Everything done
// here becomes one DDL statement, shown before it runs, because a grant is not
// something to discover the shape of afterwards.

import cwRbacRoleDialogTemplate from "./cw_rbac_role_dialog.html";
import cwRbacGrantDialogTemplate from "./cw_rbac_grant_dialog.html";
import cwRbacAssignDialogTemplate from "./cw_rbac_assign_dialog.html";
import cwRbacConfirmDialogTemplate from "./cw_rbac_confirm_dialog.html";

export default cwRbacController;

cwRbacController.$inject = ["$scope", "$rootScope", "$q", "$uibModal", "cwRbacService"];

function cwRbacController($scope, $rootScope, $q, $uibModal, cwRbacService) {
  var rbacCtl = this;

  rbacCtl.loading = true;
  rbacCtl.error = null;
  // Something worth saying that is not a failure - a purge that found the rows
  // already gone, say.
  rbacCtl.notice = null;
  // The service could not be reached at all, as opposed to having answered and
  // refused. Nothing on this page can be shown without it - every row is read
  // with a query - so this is a state of the page, not a failed field.
  rbacCtl.unavailable = false;
  rbacCtl.roles = [];
  rbacCtl.users = [];
  // Whether this viewer may change any of it. Everyone who can reach the
  // service can open this tab - a service role can carry the right to
  // administer RBAC, and no platform permission reports that - so what the
  // page offers is decided here rather than by the nav.
  rbacCtl.canManage = false;
  // Whether the cluster's user list could be read. It is ns_server's, behind a
  // platform permission of its own, so a viewer can be entitled to everything
  // on this page and still not be handed the users to hang it on.
  rbacCtl.usersReadable = true;
  rbacCtl.openRoles = {};
  rbacCtl.openUsers = {};
  rbacCtl.roleFilter = "";
  rbacCtl.userFilter = "";
  rbacCtl.keyspaces = {databases: [], scopes: {}};

  rbacCtl.refresh = refresh;
  rbacCtl.addRole = addRole;
  rbacCtl.dropRole = dropRole;
  rbacCtl.grantToRole = grantToRole;
  rbacCtl.grantToUser = grantToUser;
  rbacCtl.revokeGrant = revokeGrant;
  rbacCtl.editUserRoles = editUserRoles;
  rbacCtl.revokeRoleFromUser = revokeRoleFromUser;
  rbacCtl.purgeOrphanedGrants = purgeOrphanedGrants;
  rbacCtl.toggleRole = toggleRole;
  rbacCtl.toggleUser = toggleUser;
  rbacCtl.describeTarget = cwRbacService.describeTarget;
  rbacCtl.roleDisplayName = cwRbacService.roleDisplayName;
  rbacCtl.roleDescription = cwRbacService.roleDescription;
  rbacCtl.isBuiltIn = cwRbacService.isBuiltInRole;

  refresh();

  // ------------------------------------------------------------------ reads

  // One pass, five reads. They are joined here rather than in SQL++ because
  // the user list is ns_server's and is not a keyspace the engine can join
  // against - and because a role with no privileges must still appear.
  function refresh() {
    rbacCtl.loading = true;
    rbacCtl.error = null;
    rbacCtl.notice = null;
    rbacCtl.unavailable = false;

    rbacCtl.usersReadable = true;

    return $q.all({
      roles: cwRbacService.getRoles(),
      privileges: cwRbacService.getPrivileges(),
      assignments: cwRbacService.getAssignments(),
      keyspaces: cwRbacService.getKeyspaces().catch(function () {
        // Only the grant dialog's pickers depend on this; losing it must not
        // cost the whole page.
        return {databases: [], scopes: {}};
      }),
      users: cwRbacService.getUsers().catch(function () {
        // Losing the user list costs the Users table, not the page: role
        // administration is still perfectly usable without it.
        rbacCtl.usersReadable = false;
        return [];
      }),
      whoami: cwRbacService.getWhoami()
    }).then(function (data) {
      var includedByRole = includedRolesFrom(data.assignments);
      rbacCtl.roles = buildRoles(data.roles, data.privileges, data.assignments, includedByRole);
      rbacCtl.users = buildUsers(data.users, data.privileges, data.assignments, data.whoami,
                                 rbacCtl.usersReadable);
      rbacCtl.keyspaces = data.keyspaces;
      rbacCtl.canManage = canManage(data.whoami, data.assignments, includedByRole);
    }, function (error) {
      rbacCtl.roles = [];
      rbacCtl.users = [];
      rbacCtl.canManage = false;
      // An unreachable service is not an error to read and act on, it is a
      // cluster to come back to, so it is said once and plainly rather than as
      // whatever the proxy happened to put in the body.
      rbacCtl.unavailable = cwRbacService.isServiceUnavailableError(error);
      rbacCtl.error = rbacCtl.unavailable ? null : (error.message || String(error));
    }).finally(function () {
      rbacCtl.loading = false;
    });
  }

  // Two ways to be entitled to change any of this, and the page can only see
  // one of them from the platform.
  //
  // A platform role that can manage the service bypasses service RBAC outright
  // - the engine returns before consulting it - and ns_server reports that as
  // a permission. A service role cannot be reported that way at all: the
  // engine's own sys_root and sys_security_admin carry the right to grant, and
  // nothing ns_server knows distinguishes their holder from any other user. So
  // the second half is read from the assignment rows this page already has.
  //
  // Not knowing who the viewer is leaves only the first half, which is the
  // right way round: it withholds actions rather than offering ones that would
  // then be refused.
  function canManage(whoami, assignmentRows, includedByRole) {
    if (platformCanManage()) {
      return true;
    }
    if (!whoami) {
      return false;
    }
    return cwRbacService.holdsAdminServiceRole(
      rolesHeldBy(whoami, assignmentRows), includedByRole);
  }

  // The permissions ns_server checked for this session, published on the root
  // scope under the same name the nav's ng-show expressions read.
  function platformCanManage() {
    var cluster = ($rootScope.rbac || {}).cluster || {};
    return !!(cluster.analytics && cluster.analytics.manage);
  }

  function rolesHeldBy(whoami, assignmentRows) {
    return assignmentRows.filter(function (row) {
      return String(row.GranteeType || "USER").toUpperCase() === "USER" &&
        row.Assignee === whoami.id &&
        String(row.AssigneeDomain || "local").toLowerCase() ===
          String(whoami.domain || "local").toLowerCase();
    }).map(function (row) {
      return row.AssignedRoleName;
    });
  }

  // Which roles each role has been granted. Read once and used twice: to work
  // out what a role can do, and to follow a chain of role-to-role grants from
  // the viewer to an administering role.
  function includedRolesFrom(assignmentRows) {
    var included = {};
    assignmentRows.forEach(function (row) {
      if (String(row.GranteeType || "USER").toUpperCase() === "ROLE") {
        included[row.Assignee] = (included[row.Assignee] || []).concat(row.AssignedRoleName);
      }
    });
    return included;
  }

  function granteeKey(name, type, domain) {
    return String(type || "").toUpperCase() === "ROLE"
      ? "ROLE:" + name
      : "USER:" + String(domain || "local").toLowerCase() + ":" + name;
  }

  function buildRoles(roleRows, privilegeRows, assignmentRows, includedByRole) {
    var byKey = {};
    var roles = roleRows.map(function (row) {
      var displayName = cwRbacService.roleDisplayName(row.RoleName);
      var role = {
        name: row.RoleName,
        // A built-in reads as "Data Admin (sys_data_admin)"; a custom role has
        // only the one name, and showing it twice would say nothing. The
        // identifier stays on screen either way - it is what a GRANT takes.
        displayName: displayName,
        // What the filter matches, so typing either half finds the role.
        label: displayName ? displayName + " (" + row.RoleName + ")" : row.RoleName,
        creator: row.Creator,
        builtIn: cwRbacService.isBuiltInRole(row),
        privileges: [],
        members: []
      };
      byKey[granteeKey(role.name, "ROLE")] = role;
      return role;
    });

    privilegeRows.forEach(function (row) {
      var role = byKey[granteeKey(row.Grantee, row.GranteeType, row.GranteeDomain)];
      if (role) {
        role.privileges.push(row);
      }
    });

    // A role granted to another role is a member of it just as a user is, and
    // hiding that would misreport who a privilege actually reaches. The same
    // rows read the other way say which roles a role contains, which the caller
    // has already worked out and passes in.
    assignmentRows.forEach(function (row) {
      var role = byKey[granteeKey(row.AssignedRoleName, "ROLE")];
      if (!role) {
        return;
      }
      role.members.push({
        name: row.Assignee,
        type: String(row.GranteeType || "USER").toUpperCase(),
        domain: row.AssigneeDomain
      });
    });

    // What a role can do is its own privileges plus those of every role it
    // contains. sys_root owns no privilege rows at all - it is entirely the
    // two roles under it - so a count of its own rows reads as no access.
    roles.forEach(function (role) {
      role.includes = cwRbacService.rolesIncludedBy(role.name, includedByRole);
      role.includedNames = role.includes.map(function (name) {
        return cwRbacService.roleDisplayName(name) || name;
      });
      // Everything the role carries, in one list: its own grants first, then
      // each contained role's, tagged with where they come from. A count on
      // its own leaves sys_root expanding to nothing, which is the one role
      // whose privileges anybody wants to read.
      role.allPrivileges = role.privileges.map(function (grant) {
        return {grant: grant, via: null};
      });
      role.includes.forEach(function (name) {
        var included = byKey[granteeKey(name, "ROLE")];
        var label = cwRbacService.roleDisplayName(name) || name;
        (included ? included.privileges : []).forEach(function (grant) {
          role.allPrivileges.push({grant: grant, via: label});
        });
      });
      role.effectivePrivileges = role.allPrivileges.length;
    });

    return roles.sort(cwRbacService.compareRoles);
  }

  function buildUsers(userRows, privilegeRows, assignmentRows, whoami, usersReadable) {
    var byKey = {};
    var usedKeys = {};
    var users = userRows.map(function (row) {
      var user = {
        id: row.id,
        domain: row.domain,
        name: row.name,
        uuid: row.uuid,
        roles: [],
        privileges: []
      };
      user.key = rowKey(user);
      byKey[granteeKey(user.id, "USER", user.domain)] = user;
      return user;
    });

    // What the table repeats and expands on. It was domain and name, which are
    // no longer unique: a grant left by a deleted account sits beside the live
    // user of that name, and two rows with one key make the repeater throw
    // rather than render.
    function rowKey(user) {
      var key = user.domain + ":" + user.id;
      if (!usedKeys[key]) {
        usedKeys[key] = true;
        return key;
      }
      return key + "#" + (user.uuid || users.length);
    }

    // Find or start a row for a name, without judging whether it is live. Only
    // the viewer comes through here; grants come through granteeRow, which has
    // an account to judge against.
    function ensure(name, domain) {
      var key = granteeKey(name, "USER", domain);
      if (!byKey[key]) {
        byKey[key] = {id: name, domain: domain, name: "", unknown: usersReadable,
                      roles: [], privileges: []};
        byKey[key].key = rowKey(byKey[key]);
        users.push(byKey[key]);
      }
      return byKey[key];
    }

    // Whether a grant recorded under this name was made to the account that
    // holds the name now. Delete a user and create another of the same name and
    // the directory issues a new id, so the rows left behind grant nothing -
    // the engine compares the same two values and refuses.
    //
    // Only the directory's own id can settle it. ns_server issues one for a
    // local user; for an external user it issues none, and the engine mints its
    // own and stores it nowhere else, so there is nothing to compare against
    // and the name is the identity - which is exactly how the engine treats an
    // external user too. Hence both halves must be present before this answers
    // yes: a missing id is not evidence of anything.
    function grantIsStale(user, granteeId) {
      return !!(user.uuid && granteeId && user.uuid !== granteeId);
    }

    // The row a grant belongs on. A grant whose account no longer holds the
    // name gets a row of its own rather than joining the live user's, so a dead
    // grant cannot be read - or revoked - as a live one.
    function granteeRow(name, domain, granteeId) {
      var live = byKey[granteeKey(name, "USER", domain)];
      if (live && !grantIsStale(live, granteeId)) {
        return live;
      }
      var key = granteeKey(name, "USER", domain) + "#" + (granteeId || "");
      if (!byKey[key]) {
        byKey[key] = {
          id: name, domain: domain, name: "", uuid: granteeId,
          unknown: usersReadable,
          // A name that is in use, by somebody else. Worth saying apart from a
          // name nobody holds: the row reads as live until you know better.
          superseded: usersReadable && !!live,
          roles: [], privileges: []
        };
        byKey[key].key = rowKey(byKey[key]);
        users.push(byKey[key]);
      }
      return byKey[key];
    }

    // The viewer always gets a row. /whoami needs no permission at all -
    // ns_server registers it no_check - so this is the one account that is
    // knowable whatever else is refused, and without it a viewer who may not
    // list users is shown an empty table and no way to see what they hold
    // themselves.
    if (whoami) {
      var self = ensure(whoami.id, whoami.domain);
      self.unknown = false;
      self.self = true;
    }

    assignmentRows.forEach(function (row) {
      if (String(row.GranteeType || "USER").toUpperCase() !== "USER") {
        return;
      }
      granteeRow(row.Assignee, row.AssigneeDomain, row.AssigneeId).roles.push(row.AssignedRoleName);
    });

    privilegeRows.forEach(function (row) {
      if (String(row.GranteeType || "").toUpperCase() !== "USER") {
        return;
      }
      granteeRow(row.Grantee, row.GranteeDomain, row.GranteeUuid).privileges.push(row);
    });

    return users;
  }

  function toggleRole(role) {
    rbacCtl.openRoles[role.name] = !rbacCtl.openRoles[role.name];
  }

  function toggleUser(user) {
    rbacCtl.openUsers[user.key] = !rbacCtl.openUsers[user.key];
  }

  // ----------------------------------------------------------------- writes

  // Every write goes through here: run the statement, say what happened, and
  // re-read. Re-reading rather than patching the tables in place keeps the page
  // honest about what the engine actually stored - a grant can widen an
  // existing one rather than adding a row.
  function run(statement, description) {
    return cwRbacService.execute(statement).then(function () {
      return refresh();
    }, function (error) {
      // The banner above the tables is where this is read; a modal on top of
      // the dialog that caused it would only be in the way.
      rbacCtl.error = description + " failed: " + (error.message || String(error));
      return $q.reject(error);
    });
  }

  function dialog(template, scopeValues) {
    var dialogScope = $rootScope.$new(true);
    Object.keys(scopeValues).forEach(function (key) {
      dialogScope[key] = scopeValues[key];
    });
    var result = $uibModal.open({template: template, scope: dialogScope}).result;
    return {
      scope: dialogScope,
      result: result,
      // Dismissing a dialog rejects its promise. Callers only care about OK, so
      // the rejection is absorbed here rather than surfacing as an unhandled
      // one in every console.
      onOk: function (fn) {
        return result.then(function (answer) {
          if (answer === "ok") {
            fn();
          }
        }, function () {});
      }
    };
  }

  function addRole() {
    var taken = rbacCtl.roles.map(function (role) { return role.name; });
    var opened = dialog(cwRbacRoleDialogTemplate, {
      options: {roleName: "", taken: taken},
      isTaken: function (name) {
        return taken.indexOf(name) >= 0;
      }
    });

    opened.onOk(function () {
      run(cwRbacService.buildCreateRole(opened.scope.options.roleName), "Creating the role");
    });
  }

  function dropRole(role) {
    confirm({
      title: "Drop Role",
      // Dropping a role takes its privileges away from everyone holding it, and
      // the grants are gone with it - so the count is the warning.
      message: "Drop role " + role.name + "? " +
        (role.members.length
          ? role.members.length + " user(s) or role(s) will lose the " +
            role.privileges.length + " privilege(s) it carries."
          : "It carries " + role.privileges.length + " privilege(s)."),
      confirmLabel: "Drop Role",
      statement: cwRbacService.buildDropRole(role.name)
    }).then(function (confirmed) {
      if (confirmed) {
        run(cwRbacService.buildDropRole(role.name), "Dropping the role");
      }
    });
  }

  // A privilege can be granted to a role or straight to a user - the engine
  // takes either, and a user who needs one grant nobody else needs should not
  // force a role into existence to hold it. Which principal it is changes only
  // the grantee clause, so both entry points meet here.
  function grantToRole(role) {
    grantPrivilege({name: role.name, type: "ROLE"}, role.name);
  }

  function grantToUser(user) {
    grantPrivilege({name: user.id, type: "USER", domain: user.domain}, granteeLabel(user));
  }

  // External and local users can share a name and are different accounts, so
  // the domain is part of what the dialog has to show.
  function granteeLabel(user) {
    return String(user.domain || "local").toLowerCase() === "external"
      ? user.id + " (external)"
      : user.id;
  }

  function grantPrivilege(grantee, label) {
    var options = {
      granteeLabel: label,
      objectType: "COLLECTION",
      privileges: {},
      targetKind: "ANY",
      target: {database: "", scope: "", name: "", arity: ""}
    };

    var opened = dialog(cwRbacGrantDialogTemplate, {
      options: options,
      objectTypes: cwRbacService.OBJECT_TYPES,
      targetLabels: cwRbacService.TARGET_LABELS,
      databases: databaseNames(),
      // Which privileges and which target forms are on offer follow from the
      // object type, but they are stored rather than computed in the template:
      // ng-repeat over a function that builds fresh objects never settles, and
      // the digest aborts instead of rendering.
      privilegeOptions: [],
      targetOptions: [],
      scopes: [],
      isDdl: isDdl,
      // A privilege on an object and one on objects that do not exist yet are
      // different statements, so they cannot be granted together.
      mixesForms: function () {
        var picked = chosenPrivileges();
        return picked.some(function (p) { return p.ddl; }) && picked.some(function (p) { return !p.ddl; });
      },
      statement: previewStatement,
      isValid: function () {
        return !!previewStatement();
      }
    });

    function chosenPrivileges() {
      return opened.scope.privilegeOptions
        .filter(function (privilege) { return !!options.privileges[privilege.privilege]; });
    }

    // With nothing ticked the form is still deciding, and a DDL grant is the
    // wider of the two - so the target forms offered start as the DDL ones and
    // narrow once a privilege picks a side.
    function isDdl() {
      var picked = chosenPrivileges();
      return picked.length ? picked[0].ddl : true;
    }

    function previewStatement() {
      var picked = chosenPrivileges();
      if (!picked.length || opened.scope.mixesForms()) {
        return "";
      }
      try {
        return cwRbacService.buildGrant({
          privileges: picked.map(function (p) { return p.privilege; }),
          objectType: options.objectType,
          ddl: picked[0].ddl,
          targetKind: options.targetKind,
          target: options.target,
          grantees: [grantee]
        });
      } catch (error) {
        // An incomplete form - no database chosen yet - is not an error to
        // show, it is simply nothing to preview.
        return "";
      }
    }

    // Changing the object type invalidates the ticked privileges, the offered
    // ones and the target form: SELECT means something on a collection and
    // nothing on a link, and leaving either behind builds a statement for the
    // type that was chosen before.
    opened.scope.$watch("options.objectType", function (newType, oldType) {
      if (newType !== oldType) {
        options.privileges = {};
        options.targetKind = "ANY";
      }
      opened.scope.privilegeOptions = cwRbacService.privilegesFor(newType);
    });

    // The offered target forms depend on the object type and on whether what is
    // ticked is a DDL privilege, so they follow both.
    opened.scope.$watch(isDdl, refreshTargets);
    opened.scope.$watch("options.objectType", refreshTargets);

    opened.scope.$watch("options.target.database", function () {
      opened.scope.scopes = scopeNames(options.target.database);
    });

    function refreshTargets() {
      opened.scope.targetOptions = cwRbacService.targetsFor(options.objectType, isDdl());
      if (opened.scope.targetOptions.indexOf(options.targetKind) < 0) {
        options.targetKind = opened.scope.targetOptions[0] || "ANY";
      }
    }

    opened.onOk(function () {
      var statement = previewStatement();
      if (statement) {
        run(statement, "Granting the privilege");
      }
    });
  }

  function revokeGrant(grantee, row) {
    var statement = cwRbacService.revokeForGrant(row);
    confirm({
      title: "Revoke Privilege",
      message: "Revoke " + row.Privilege + " on " + cwRbacService.describeTarget(row) +
        " from " + grantee + "?",
      confirmLabel: "Revoke",
      statement: statement
    }).then(function (confirmed) {
      if (confirmed) {
        run(statement, "Revoking the privilege");
      }
    });
  }

  function editUserRoles(user) {
    var held = user.roles.slice();
    var options = {selected: {}};
    held.forEach(function (name) { options.selected[name] = true; });

    var opened = dialog(cwRbacAssignDialogTemplate, {
      options: options,
      user: user,
      roles: rbacCtl.roles,
      // Both directions in one dialog: what a user holds is a set, and the
      // natural way to edit a set is to tick and untick it, not to run an
      // assign flow and a separate unassign flow.
      statement: function () {
        var change = pendingRoleChange();
        return [change.granted.length ? cwRbacService.buildGrantRoles(change.granted, [grantee(user)]) : "",
                change.revoked.length ? cwRbacService.buildRevokeRoles(change.revoked, [grantee(user)]) : ""]
          .filter(Boolean).join(";\n");
      },
      isValid: function () {
        var change = pendingRoleChange();
        return change.granted.length > 0 || change.revoked.length > 0;
      }
    });

    function pendingRoleChange() {
      var wanted = Object.keys(options.selected).filter(function (name) { return options.selected[name]; });
      return {
        granted: wanted.filter(function (name) { return held.indexOf(name) < 0; }),
        revoked: held.filter(function (name) { return wanted.indexOf(name) < 0; })
      };
    }

    opened.onOk(function () {
      var change = pendingRoleChange();
      // Grant first: a user who is losing one role and gaining another should
      // not be left with neither if the second statement fails.
      var chain = change.granted.length
        ? run(cwRbacService.buildGrantRoles(change.granted, [grantee(user)]), "Granting the role")
        : $q.resolve();
      chain.then(function () {
        if (change.revoked.length) {
          return run(cwRbacService.buildRevokeRoles(change.revoked, [grantee(user)]), "Revoking the role");
        }
        return null;
      });
    });
  }

  function revokeRoleFromUser(user, roleName) {
    var statement = cwRbacService.buildRevokeRoles([roleName], [grantee(user)]);
    confirm({
      title: "Revoke Role",
      message: "Revoke role " + roleName + " from " + user.id + "?",
      confirmLabel: "Revoke",
      statement: statement
    }).then(function (confirmed) {
      if (confirmed) {
        run(statement, "Revoking the role");
      }
    });
  }

  // Cleaning up after an account the cluster no longer has.
  //
  // Addressed by the uuid the grants were made to, not by the name they were
  // made under, which is what lets this work where a live account has taken the
  // name over. The engine answers with a count of the rows it deleted.
  //
  // It used to be a revoke sent for its side effect - the engine validated the
  // grantee, found no such user, deleted their rows and only then reported that
  // the user did not exist, so the error was the success. That could only ever
  // clean an unclaimed name: where a live account held it the engine resolved
  // the name to that account, revoked a grant it never had, and reported
  // success having removed nothing. MB-73954 replaced it with an endpoint that
  // says which account it means.
  function purgeOrphanedGrants(user) {
    var rows = user.privileges.length + user.roles.length;

    confirm({
      title: "Purge Orphaned Grants",
      message: (user.superseded
        ? "The user called " + user.id + " today is a different account from the one these " +
          "were granted to. Purge all "
        : "No cluster user matches " + user.id + ". Purge all ") +
        user.privileges.length + " privilege(s) and " + user.roles.length +
        " role assignment(s) recorded against the account that held that name? " +
        "They grant nothing today.",
      confirmLabel: "Purge",
      // Not a statement, for once: this one is a REST call, and showing a
      // statement that will not be run would be a lie about what is about to
      // happen.
      statement: ""
    }).then(function (confirmed) {
      if (!confirmed) {
        return null;
      }
      return cwRbacService.purgeGrantee(user).then(function (removed) {
        return refresh().then(function () {
          // A purge that deleted nothing is worth saying, and only after the
          // re-read, which clears it. It means the rows went between the read
          // and the click - the engine drops them itself the next time it meets
          // the name - rather than that anything failed.
          if (!removed && rows) {
            rbacCtl.notice = "Nothing left to purge for " + user.id +
              "; those rows had already gone.";
          }
        });
      }, function (error) {
        rbacCtl.error = "Purging the orphaned grants failed: " + (error.message || String(error));
        return $q.reject(error);
      });
    });
  }

  function grantee(user) {
    return {name: user.id, type: "USER", domain: user.domain};
  }

  function confirm(options) {
    return dialog(cwRbacConfirmDialogTemplate, {options: options}).result
      .then(function (answer) { return answer === "ok"; },
            function () { return false; });
  }

  // ------------------------------------------------ metadata for the pickers

  // Read with the rest of the page rather than from the workbench: this tab
  // has to work whether or not the Workbench tab has ever been opened.
  function databaseNames() {
    return rbacCtl.keyspaces.databases;
  }

  function scopeNames(databaseName) {
    return rbacCtl.keyspaces.scopes[databaseName] || [];
  }

  $scope.$on("$destroy", function () {
    rbacCtl.roles = [];
    rbacCtl.users = [];
  });
}

/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The Service RBAC tab of the Security section, lazily loaded when that tab
// is first opened.
//
// It hangs off app.admin.security, which the admin console owns, rather than
// off app.admin.cbas: administering who may do what belongs beside the cluster
// users, not inside the workbench. None of the workbench is loaded here, and
// nothing here depends on it - this tab has to render whether or not the
// Workbench tab has ever been opened.

import angular from "angular";

import uiRouter from "@uirouter/angularjs";
import uiBootstrap from "angular-ui-bootstrap";

import cwRbacService from "./cw_rbac_service.js";
import cwRbacController from "./cw_rbac_controller.js";

import cbasRbacTemplate from "./cbas_rbac.html";

export default "cwCbasRbac";

angular.module("cwCbasRbac", [
  uiRouter,
  uiBootstrap,

  cwRbacService,
])
  .config(["$stateProvider", function ($stateProvider) {
    $stateProvider
      .state("app.admin.security.analyticsRbac", {
        url: "/analyticsRbac",
        controller: "cwRbacController as rbacCtl",
        template: cbasRbacTemplate,
        data: {
          // The permission the router checks before entering this state.
          //
          // It has to be stated, because a state's data is inherited from its
          // parent: app.admin.security carries "cluster.admin.security.read ||
          // cluster.admin.users.read", and without an override of its own this
          // tab would demand one of those. Neither has anything to do with
          // reaching this service, and a user who holds a service role that
          // administers RBAC - and so needs this page - may well hold neither.
          //
          // The hook in the admin console's app_config.js reads it from the
          // state being entered, so this one wins over the inherited value.
          // data.title is not restated: it is inherited the same way, which is
          // what leaves the nav trail reading "> Security" like every other
          // tab in this section.
          permissions: "cluster.analytics.access || cluster.analytics.manage"
        }
      });
  }])
  .controller("cwRbacController", cwRbacController);

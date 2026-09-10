/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";
import app from "app";
import ace from 'ace/ace-wrapper';
import { mnLazyload } from "mn.app.imports";

import { NgModule } from '@angular/core';
import { UIRouterUpgradeModule } from '@uirouter/angular-hybrid';

import { QwCollectionMenu }       from "../query/angular-directives/qw.collection.menu.component.js";
import { QwJsonDataTableComp }    from "../query/angular-directives/qw.json.datatable.directive.js";
import { QwExplainViz }           from "../query/angular-directives/qw.explain.viz.component.js";
import { QwDialogService }        from "../query/angular-directives/qw.dialog.service.js";

import { QwCollectionsService }   from "../query/angular-services/qw.collections.service.js";
import { QwQueryPlanService }     from "../query/angular-services/qw.query.plan.service.js";

angular
  .module(app)
  .config(["mnPluggableUiRegistryProvider", "mnPermissionsProvider", function (mnPluggableUiRegistryProvider, mnPermissionsProvider) {

    ace.config.set('basePath','/ui/libs/ace');

    mnPluggableUiRegistryProvider.registerConfig({
      name: 'Analytics',
      includedByState: 'app.admin.cbas',
      state: 'app.admin.cbas.workbench',
      plugIn: 'workbenchTab',
      ngShow: "rbac.cluster.collection['.:.:.'].analytics.select || rbac.cluster.analytics.manage",
      index: 3
    });

    // Service RBAC, in the Security section beside Users & Groups. Service
    // roles and privileges are the analytics engine's own, not ns_server's -
    // the platform roles on Users & Groups decide who may reach the service at
    // all, these decide what they may do inside it. They are administered
    // alongside the users they are granted to, so the tab plugs into that nav
    // rather than starting a section of its own.
    //
    // 'after' names the tab this one follows: the security nav marks its Users
    // link mn-tab="users". Without a match the registry throws rather than
    // appending, so the two have to be changed together.
    mnPluggableUiRegistryProvider.registerConfig({
      name: 'Service RBAC',
      state: 'app.admin.security.analyticsRbac',
      plugIn: 'securityTab',
      after: 'users',
      // Shown to anyone who may reach the service, not only to whoever may
      // administer it. Two reasons, and the first is the important one:
      //
      // A service role can carry the right to administer service RBAC -
      // sys_root and sys_security_admin both do - and a user holding one needs
      // no platform role beyond the access that lets them reach the service at
      // all. ns_server knows nothing of service roles, so no permission it can
      // report distinguishes that user from any other; gating on manage locked
      // them out of the only page that administers what they administer.
      //
      // And the page is worth opening read-only: what a user may do inside the
      // service is otherwise discoverable only by writing SQL++ against the
      // metadata by hand. The page decides for itself what to offer - see
      // cwRbacController's canManage - so a viewer who may only look gets the
      // tables without the actions.
      ngShow: "rbac.cluster.analytics.access || rbac.cluster.analytics.manage",
      index: 1
    });

    mnPermissionsProvider.setBucketSpecific(function (name) {
      return [
        "cluster.collection[" + name + ":.:.].analytics!select", "cluster.analytics!manage"
      ]
    })

  }]);

class CbasUI {
  static get annotations() { return [
    new NgModule({
      imports: [
        UIRouterUpgradeModule.forRoot({
          states: [{
            name: "app.admin.cbas.**",
            url: "/cbas",
            lazyLoad: mnLazyload(() => import('./cbas.js'), 'cwCbas')
          }, {
            name: "app.admin.security.analyticsRbac.**",
            url: "/analyticsRbac",
            // Stated here as well as on the state cbas_rbac.js registers.
            // A future state's parent is worked out by dropping both the '**'
            // and the segment before it, so this one's parent is
            // app.admin.security and it inherits that state's permissions -
            // which name the platform roles for users and security settings,
            // neither of which has anything to do with reaching this service.
            // The lazy-load hook runs before the permission hook, so today the
            // inherited value is never the one checked; restating it means the
            // two orders cannot disagree.
            data: {permissions: "cluster.analytics.access || cluster.analytics.manage"},
            lazyLoad: mnLazyload(() => import('./cbas_rbac.js'), 'cwCbasRbac')
          }]
        })
      ],
      // because the Analytics Workbench is still AngularJS, yet relies on
      // downgradeInjectable versions of the following Angular services,
      // we need to list them as providers here to ensure that they are loaded.
      // otherwise we get "missing provider" errors when reloading the UI
      providers: [
        QwCollectionsService,
        QwDialogService,
        QwQueryPlanService,
      ],
      entryComponents: [
        QwCollectionMenu,
        QwExplainViz,
        QwJsonDataTableComp,
      ]
    })
  ]}
}

export default CbasUI;

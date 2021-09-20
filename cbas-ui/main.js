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
import { QwCollectionsService }   from "../query/angular-services/qw.collections.service.js";

angular
  .module(app)
  .config(function (mnPluggableUiRegistryProvider, mnPermissionsProvider) {

    ace.config.set('basePath','/ui/libs/ace');

    mnPluggableUiRegistryProvider.registerConfig({
      name: 'Analytics',
      includedByState: 'app.admin.cbas',
      state: 'app.admin.cbas.workbench',
      plugIn: 'workbenchTab',
      ngShow: "rbac.cluster.collection['.:.:.'].analytics.select || rbac.cluster.analytics.manage",
      index: 3
    });

    mnPermissionsProvider.setBucketSpecific(function (name) {
      return [
        "cluster.collection[" + name + ":.:.].analytics!select", "cluster.analytics!manage"
      ]
    })

  });

class CbasUI {
  static get annotations() { return [
    new NgModule({
      imports: [
        UIRouterUpgradeModule.forRoot({
          states: [{
            name: "app.admin.cbas.**",
            url: "/cbas",
            lazyLoad: mnLazyload(() => import('./cbas.js'), 'cwCbas')
          }]
        })
      ],
      // because the Analytics Workbench is still AngularJS, yet relies on
      // downgradeInjectable versions of the following Angular services,
      // we need to list them as providers here to ensure that they are loaded.
      // otherwise we get "missing provider" errors when reloading the UI
      providers: [
        QwCollectionsService
      ],
      entryComponents: [
        QwCollectionMenu
      ]
    })
  ]}
}

export default CbasUI;

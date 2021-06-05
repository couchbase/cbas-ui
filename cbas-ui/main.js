import angular from "/ui/web_modules/angular.js";
import app from "/ui/app/app.js";
import ace from '/ui/libs/ace/ace-wrapper.js';
import { mnLazyload } from "/ui/app/mn.app.imports.js";

import { NgModule } from '/ui/web_modules/@angular/core.js';
import { UIRouterUpgradeModule } from '/ui/web_modules/@uirouter/angular-hybrid.js';

import { QwCollectionMenu }       from "/_p/ui/query/angular-directives/qw.collection.menu.component.js";
import { QwCollectionsService }   from "/_p/ui/query/angular-services/qw.collections.service.js";

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
            lazyLoad: mnLazyload('/_p/ui/cbas/cbas.js', 'cwCbas')
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

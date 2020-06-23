import angular from "/ui/web_modules/angular.js";
import app from "/ui/app/app.js";
import ace from '/ui/libs/ace/ace-wrapper.js';

import { NgModule } from '/ui/web_modules/@angular/core.js';
import { UIRouterUpgradeModule } from '/ui/web_modules/@uirouter/angular-hybrid.js';

angular
  .module(app)
  .config(function (mnPluggableUiRegistryProvider, mnPermissionsProvider) {

    ace.config.set('basePath','/ui/libs/ace');

    mnPluggableUiRegistryProvider.registerConfig({
      name: 'Analytics',
      state: 'app.admin.cbas.workbench',
      plugIn: 'workbenchTab',
      ngShow: "rbac.cluster.bucket['.'].analytics.select || rbac.cluster.analytics.manage",
      index: 3
    });

    mnPermissionsProvider.setBucketSpecific(function (name) {
      return [
        "cluster.bucket[" + name + "].analytics!select", "cluster.analytics!manage"
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
            lazyLoad: ($transition$) => {
              return import('/_p/ui/cbas/cbas.js').then(m => {
                $transition$.injector().get('$ocLazyLoad').load({name: 'cwCbas'});
              });
            }
          }]
        })
      ]
    })
  ]}
}

export default CbasUI;

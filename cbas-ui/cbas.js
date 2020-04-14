import angular from "/ui/web_modules/angular.js";
import _ from "/ui/web_modules/lodash.js";
import ace from '/ui/libs/ace/ace-wrapper.js';
import saveAs from "/ui/web_modules/file-saver.js";

import uiRouter from "/ui/web_modules/@uirouter/angularjs.js";
import uiBootstrap from "/ui/web_modules/angular-ui-bootstrap.js";
import uiAce from "/ui/libs/ui-ace.js";

import qwJsonTree from "/_p/ui/query/ui-current/data_display/qw-json-tree.directive.js";
import qwJsonDataTable from "/_p/ui/query/ui-current/data_display/qw-json-datatable.directive.js";
import qwJsonTableEditor from "/_p/ui/query/ui-current/data_display/qw-json-table-editor.directive.js";
import qwLongPress from "/_p/ui/query/long_press/qw-long-press.directive.js";

import mnJquery from "/ui/app/components/mn_jquery.js";
import mnPools from "/ui/app/components/mn_pools.js";
import mnPoolDefault from "/ui/app/components/mn_pool_default.js";
import mnPermissions from "/ui/app/components/mn_permissions.js";
import mnServersService from "/ui/app/mn_admin/mn_servers_service.js";
import mnStatisticsNewService from "/ui/app/mn_admin/mn_statistics_service.js";

import cwCbasMonitorController from "/_p/ui/cbas/cw_cbas_monitor_controller.js";
import cbasController from "/_p/ui/cbas/cw_cbas_controller.js";

import qwQueryService from "/_p/ui/query/qw_query_service.js";
import cwQueryService from "/_p/ui/cbas/cw_query_service.js";
import cwConstantsService from "/_p/ui/cbas/cw_constants_service.js";
import validateCbasService from "./validate_cbas_service.js"
import qwJsonCsvService from "/_p/ui/query/qw_json_csv_service.js";


export default "cwCbas";

angular.module('cwCbas', [
  uiRouter,
  uiBootstrap,
  uiAce,

  qwJsonTree,
  qwJsonDataTable,
  qwJsonTableEditor,
  qwLongPress,

  mnJquery,
  mnPools,
  mnPoolDefault,
  mnPermissions,
  mnServersService,
  mnStatisticsNewService,

  qwQueryService,
  cwQueryService,
  cwConstantsService,
  validateCbasService,
  qwJsonCsvService
])
  .config(function($stateProvider, $transitionsProvider) {

    $stateProvider
      .state('app.admin.cbas', {
        abstract: true,
        url: '/cbas',
        views: {
          "main@app.admin": {
            controller: 'cwCbasController as qc',
            templateUrl: '../_p/ui/cbas/cbas_toplevel.html'
          }
        },
        data: {
          title: "Analytics"
        }
      });

    $stateProvider
      .state('app.admin.cbas.monitoring', {
        url: '/monitoring',
        controller: 'cwCbasMonitorController as qmc',
        templateUrl: '../_p/ui/cbas/cbas_monitoring.html'
      })
      .state('app.admin.cbas.workbench', {
        url: '/workbench?query',
        controller: 'cwCbasController as qc',
        templateUrl: '../_p/ui/cbas/cbas.html'
      });

    //
    // whenever the user logs out, we want ensure that validateCbasService knows it needs
    // to re-validate
    //

    $transitionsProvider.onFinish({
      from: "app.auth",
      to: "app.admin.**",
    }, function ($transition$, $state, $injector) {
      var injector = $injector || $transition$.injector();
      var cwQueryService = injector.get("cwQueryService");
      cwQueryService.updateBuckets();
    });


    //      mnPermissionsProvider.setBucketSpecific(function (name) {
    //        return [
    //          "cluster.bucket[" + name + "].n1ql.select!execute"
    //        ]
    //      })

  })
  .controller('cwCbasController', cbasController)
  .controller('cwCbasMonitorController', cwCbasMonitorController);

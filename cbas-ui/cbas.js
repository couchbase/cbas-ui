/*
Copyright 2017-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";
import _ from "lodash";
import saveAs from "file-saver";

import uiRouter from "@uirouter/angularjs";
import uiBootstrap from "angular-ui-bootstrap";
import uiAce from "ui-ace";

import mnAlertsService from 'components/mn_alerts';
import mnJquery from "components/mn_jquery";
import mnPools from "components/mn_pools";
import mnPoolDefault from "components/mn_pool_default";
import mnPermissions from "components/mn_permissions";
import mnServersService from "mn_admin/mn_servers_service";
import mnStatisticsNewService from "mn_admin/mn_statistics_service";

import cwCbasMonitorController from "./cw_cbas_monitor_controller.js";
import cbasController from "./cw_cbas_controller.js";

import cwQueryService from "./cw_query_service.js";
import cwConstantsService from "./cw_constants_service.js";
import validateCbasService from "./validate_cbas_service.js"

import { QwCollectionMenu }     from "../query/angular-directives/qw.collection.menu.component.js";
import { QwExplainViz }         from "../query/angular-directives/qw.explain.viz.component.js";
import { QwJsonChart }          from "../query/angular-directives/qw.json.chart.component.js";
import { QwJsonDataTable,
         QwJsonDataTableComp }  from "../query/angular-directives/qw.json.datatable.directive.js";

import { QwCollectionsService } from "../query/angular-services/qw.collections.service.js";
import { QwJsonCsvService }     from "../query/angular-services/qw.json.csv.service.js";
import { QwQueryPlanService }   from "../query/angular-services/qw.query.plan.service.js";
import { QwQueryService }       from "../query/angular-services/qw.query.service.js";

import {downgradeComponent}     from "@angular/upgrade/static";
import {downgradeInjectable}    from '@angular/upgrade/static';


export default "cwCbas";

angular.module('cwCbas', [
  uiRouter,
  uiBootstrap,
  uiAce,

  mnAlertsService,
  mnJquery,
  mnPools,
  mnPoolDefault,
  mnPermissions,
  mnServersService,
  mnStatisticsNewService,

  cwQueryService,
  cwConstantsService,
  validateCbasService,
])
  .directive('qwCollectionMenu', downgradeComponent({component: QwCollectionMenu}))
  .directive('qwExplainViz', downgradeComponent({component: QwExplainViz}))
  .directive('qwJsonChart', downgradeComponent({component: QwJsonChart}))
  .directive('qwJsonDataTableComp', downgradeComponent({component: QwJsonDataTableComp}))
  .directive('qwJsonDataTable', downgradeComponent({directive: QwJsonDataTable}))

  .factory('qwJsonCsvService', downgradeInjectable(QwJsonCsvService))
  .factory('qwQueryService', downgradeInjectable(QwQueryService))
  .factory('qwQueryPlanService', downgradeInjectable(QwQueryPlanService))
  .factory('qwCollectionsService', downgradeInjectable(QwCollectionsService))
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

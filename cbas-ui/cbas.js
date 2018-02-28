(function () {
  "use strict";

  angular
  .module('cwCbas', ["ui.router", "mnPluggableUiRegistry", "mnJquery",
    'qwJsonTree',
    'qwJsonTable',
    'qwJsonTableEditor',
    'qwExplainViz',
    'qwLongPress',
    'mnPendingQueryKeeper',
    'mnServersService',
    'mnPoolDefault',
    'mnPermissions',
    'ui.ace',
    'ui.bootstrap'])
    .config(function($stateProvider, $transitionsProvider, mnPluggableUiRegistryProvider, mnPermissionsProvider) {

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

      addQueryStates("app.admin.cbas");

      function addQueryStates(parent) {
        $stateProvider
        .state(parent + '.workbench', {
          url: '/workbench?query',
          templateUrl: '../_p/ui/cbas/cbas.html'
        })
        ;
      }

      mnPluggableUiRegistryProvider.registerConfig({
        name: 'Analytics',
        state: 'app.admin.cbas.workbench',
        plugIn: 'workbenchTab',
        index: 2
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

//      mnPermissionsProvider.set("cluster.n1ql.meta!read"); // system catalogs
//      mnPermissionsProvider.setBucketSpecific(function (name) {
//        return [
//          "cluster.bucket[" + name + "].n1ql.select!execute"
//        ]
//      })

    })
    .run(function(jQuery, $timeout, $http) {
    })

    // we can only work if we have an analytics node. This service checks for
    // an analytics node a reports back whether it is present.

      .factory('validateCbasService', function ($http, mnServersService, mnPermissions, cwConstantsService) {
        var _checked = false;              // have we checked validity yet?
        var _valid = false;                // do we have a valid query node?
        var _InProgress = false;    // are we retrieving the list of buckets?
        var _otherStatus;
        var _otherError;
        var service = {
          inProgress: function () {
            return !_checked || _InProgress;
          },
          valid: function () {
            return _valid;
          },
          otherStatus: function () {
            return _otherStatus;
          },
          otherError: function () {
            return _otherError;
          },
          checkLiveness: checkLiveness
        };

        function checkLiveness(callback) {
          // make sure we only do this once at a time
          if (_InProgress) {
            return;
          }

          _valid = false;
          _checked = true;
          _otherStatus = null;
          _otherError = null;
          _InProgress = true;

          var pingRequest = {
            url: cwConstantsService.healthCheckURL,
            method: "GET",
            headers: {'ignore-401': 'true'}
          };
          $http(pingRequest).then(function success(resp) {
                mnPermissions.check().then(function () {
                  _valid = true;
                  _InProgress = false;
                  if (callback) {
                    callback();
                  }
                });
              },
              // Error from $http
              function error(resp) {
                var data = resp.data, status = resp.status;
                _valid = false;
                _InProgress = false;
                _otherStatus = status;
                _otherError = data;
              });
        }

        // now return the service
        return service;
      });


  angular.module('mnAdmin').requires.push('cwCbas');
}());

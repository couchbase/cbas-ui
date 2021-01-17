(function () {
  "use strict";

  angular
  .module('cwCbas', ["ui.router", "mnPluggableUiRegistry", "mnJquery",
    'qwJsonTree',
    'qwJsonDataTable',
    'qwJsonTableEditor',
    'qwLongPress',
    'mnAutocompleteOff',
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
        .state(parent + '.monitoring', {
          url: '/monitoring',
          controller: 'cwCbasMonitorController as qmc',
          templateUrl: '../_p/ui/cbas/cbas_monitoring.html'
        })
        .state(parent + '.workbench', {
          url: '/workbench?query',
          controller: 'cwCbasController as qc',
          templateUrl: '../_p/ui/cbas/cbas.html'
        })
        ;
      }

      mnPluggableUiRegistryProvider.registerConfig({
        name: 'Analytics',
        state: 'app.admin.cbas.workbench',
        plugIn: 'workbenchTab',
        ngShow: "rbac.cluster.bucket['.'].analytics.select || rbac.cluster.analytics.manage",
        index: 3
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

     // mnPermissionsProvider.set("cluster.analytics!select");
     mnPermissionsProvider.setBucketSpecific(function (name) {
       return [
         "cluster.bucket[" + name + "].analytics!select", "cluster.analytics!manage"
       ]
     })

    })
    .run(function(jQuery, $timeout, $http) {
    })

    // we can only work if we have an analytics node. This service checks for
    // an analytics node a reports back whether it is present.

      .factory('validateCbasService', function ($http, mnServersService, mnPermissions, cwConstantsService) {
        var _checked = false;              // have we checked validity yet?
        var _valid = false;                // do we have a valid query node?
        var _InProgress = false;    // are we retrieving the list of buckets?
        var _userHasAnyBuckets = false;
        var _userCanAccessStats = false;
        var _userCanAccessLinks = false;
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
          userHasAnyBuckets: function() {
            return _userHasAnyBuckets;
          },
          canAccessStats: function() {
            return _userCanAccessStats;
          },
          canAccessLinks: function() {
            return _userCanAccessLinks;
          },
          checkLiveness: checkLiveness
        };

        function checkLiveness(callback) {
          // make sure we only do this once at a time
          if (_InProgress) {
            return;
          }

          _valid = false;
          _userHasAnyBuckets = false;
          _userCanAccessStats = false;
          _userCanAccessLinks = false;
          _checked = true;
          _otherStatus = null;
          _otherError = null;
          _InProgress = true;

          var pingRequest = {
            url: cwConstantsService.healthCheckURL,
            method: "GET",
            headers: {'ignore-401': 'true', 'Analytics-Priority': '-1'}
          };
          $http(pingRequest).then(function success(resp) {
                _valid = true;
                checkUserPermissions(callback);
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

        function checkUserPermissions(callback) {
          mnPermissions.check().then(function success() {
            var perms = mnPermissions.export.cluster;
            if (perms) {
              if(perms.bucket["."] && perms.bucket["."].settings.read) {
                 _userHasAnyBuckets = true;
              }
              var analyticsAdmin = isAnalyticsAdmin(perms);
              if ((perms.bucket["."] && perms.bucket["."].analytics && perms.bucket["."].analytics.select) ||
                  analyticsAdmin) {
                _userCanAccessStats = true;
              }
              if (analyticsAdmin) {
                _userCanAccessLinks = true;
              }
            }
          }).finally(function () {
            _InProgress = false;
            if (callback) {
              callback();
            }
          });
        }

        function isAnalyticsAdmin(perms) {
          return perms.analytics && perms.analytics.manage;
        }

        // now return the service
        return service;
      });


  angular.module('mnAdmin').requires.push('cwCbas');
}());

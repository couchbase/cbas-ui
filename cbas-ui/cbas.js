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
            controller: 'cwCbasController',
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
          controller: 'cwCbasController',
          templateUrl: '../_p/ui/cbas/cbas.html'
        })
        ;
      }

      mnPluggableUiRegistryProvider.registerConfig({
        name: 'Analytics',
        state: 'app.admin.cbas.workbench',
        plugIn: 'adminTab',
        after: 'indexes'
      });

      //
      // whenever the user logs out, we want ensure that validateCbasService knows it needs
      // to re-validate
      //

//      $transitionsProvider.onFinish({
//        from: "app.auth",
//        to: "app.admin.**",
//      }, function ($transition$, $state, $injector) {
//        var injector = $injector || $transition$.injector();
//        var qwQueryService = injector.get("qwQueryService");
//        qwQueryService.updateBuckets();
//      });

//      mnPermissionsProvider.set("cluster.n1ql.meta!read"); // system catalogs
//      mnPermissionsProvider.setBucketSpecific(function (name) {
//        return [
//          "cluster.bucket[" + name + "].n1ql.select!execute"
//        ]
//      })

    })
    .run(function(jQuery, $timeout, $http) {
    })

    // we can only work if we have a query node. This service checks for
    // a query node a reports back whether it is present.

    .factory('validateCbasService', function($http,mnServersService,mnPermissions, mnPoolDefault) {
      var _checked = true;              // have we checked validity yet?
      var _valid = true;                // do we have a valid query node?
      var _bucketsInProgress = false;    // are we retrieving the list of buckets?
      var _monitoringAllowed = false;
      var _clusterStatsAllowed = false;
      var _otherStatus;
      var _otherError;
      var _bucketList = [];
      var _bucketStatsList = [];
      var service = {
          inProgress: function()       {return !_checked || _bucketsInProgress;},
          valid: function()            {return _valid;},
          validBuckets: function()     {return _bucketList;},
          otherStatus: function()      {return _otherStatus;},
          otherError: function()       {return _otherError;},
          monitoringAllowed: function() {return _monitoringAllowed;},
          clusterStatsAllowed: function() {return _clusterStatsAllowed;},
          updateValidBuckets: getBuckets,
          getBucketsAndNodes: getBuckets
      }

      //
      // with RBAC the only safe way to get the list of buckets is through a query
      // of system:keyspaces, which should return only accessible buckets for the user.
      // we accept a callback function that will be called once the list of buckets is updated.
      //

      function getBuckets(callback) {
        //console.trace();
        //console.log("Getting nodes and buckets, progress: " + _nodesInProgress + ", " + _bucketsInProgress);

        // make sure we only do this once at a time
//        if (_bucketsInProgress)
//         return;
//
//        //_valid = false;
//        _checked = true;
//        _otherStatus = null;
//        _otherError = null;
//        _bucketsInProgress = true;
//
//        // meanwhile issue a query to the local node get the list of buckets
//        var queryData = {statement: "select keyspaces.name from system:keyspaces;"};
//        $http.post("/_p/query/query/service",queryData)
//        .then(function success(resp) {
//          //var data = resp.data, status = resp.status;
//          //console.log("Got bucket list data: " + JSON.stringify(data));
//          mnPermissions.check().then(function() {
//            updateValidBuckets();
//            if (callback) callback();
//          });
//        },
//        // Error from $http
//        function error(resp) {
//          var data = resp.data, status = resp.status;
//          //console.log("Error getting keyspaces: " + JSON.stringify(data));
//          _valid = false; _bucketsInProgress = false;
//          _otherStatus = status;
//          _otherError = data;
//        });
      }

      function updateValidBuckets() {
        // see what buckets we have permission to access
//        var perms = mnPermissions.export.cluster;
//        console.log("Got bucket permissions... " + JSON.stringify(mnPermissions.export.data));
//
//        _bucketList = []; _bucketStatsList = [];
//
//        // stats perms
//        _clusterStatsAllowed = (perms && perms.stats && perms.stats.read);
//
//        // metadata perms
//        _monitoringAllowed = (perms && perms.n1ql && perms.n1ql.meta && perms.n1ql.meta.read);
//
//        // per-bucket perms
//        if (perms && perms.bucket)
//          _.forEach(perms.bucket,function(v,k) {
//            // uncomment the following when RBAC is working properly for data access
//            if (v && v.n1ql && v.n1ql.select && v.n1ql.select.execute)
//              _bucketList.push(k);
//            if (v && v.stats && v.stats.read && k != "*") {
//              _bucketStatsList.push(k);
//            }
//          });
//
//        //console.log("valid bucketList: " + JSON.stringify(_bucketList));
//        //console.log("bucketStatsList: " + JSON.stringify(_bucketStatsList));
//
//        // all done
//        _valid = true; _bucketsInProgress = false;
      }


      // now return the service
      return service;
    });


  angular.module('mnAdmin').requires.push('cwCbas');
}());

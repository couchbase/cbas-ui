import mnPermissions from "/ui/app/components/mn_permissions.js";
import cwConstantsService from "/_p/ui/cbas/cw_constants_service.js";
// we can only work if we have an analytics node. This service checks for
// an analytics node a reports back whether it is present.
export default 'validateCbasService';

angular
  .module('validateCbasService', [mnPermissions, cwConstantsService])
  .factory('validateCbasService', function ($http, mnPermissions, cwConstantsService) {
        var _checked = false;              // have we checked validity yet?
        var _valid = false;                // do we have a valid query node?
        var _InProgress = false;    // are we retrieving the list of buckets?
        var _userHasAnyBuckets = false;
        var _userCanAccessStats = false;
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
                checkUserPermissions();
                _valid = true;
                _InProgress = false;
                if (callback) {
                  callback();
                }
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

        function checkUserPermissions() {
          mnPermissions.check().then(function success() {
            var perms = mnPermissions.export.cluster;
            if (perms) {
              if(perms.bucket["."] && perms.bucket["."].settings.read) {
                 _userHasAnyBuckets = true;
              }
              if (perms.settings && perms.settings.read) {
                _userCanAccessStats = true;
              }
            }
          });
        }

        // now return the service
        return service;
      });

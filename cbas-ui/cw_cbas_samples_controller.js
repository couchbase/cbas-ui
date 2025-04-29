/*
Copyright 2019-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

export default cbasSamplesController;
cbasSamplesController.$inject = ["$scope", "$timeout", "$http", "cwQueryService", "mnAlertsService"];
function cbasSamplesController ($scope, $timeout, $http, cwQueryService, mnAlertsService) {
  var qsc = this;

  //
  // Do we have a REST API to work with?
  //

  qsc.loadSampleData = loadSampleData;
  var url = "/_p/cbas/api/v1/samples";
  var request = {
    url: url,
    method: "GET",
  };
  $http(request).then(function (response) {
    qsc.samples = Array.isArray(response.data) ? response.data : [];
    console.log('qsc.samples =', qsc.samples, ', response.data = ', response.data);
  }).catch(function (error) {
    console.error('Error fetching samples:', error);
  });

  function loadSampleData() {
    const selected = !!this.form.travelSample;
    console.log('Load Sample Data clicked. travelSample =', selected);

    // Your actual action here
    if (selected) {
      // Call a service, emit an event, etc.
      //console.log('Loading travel sample data...');
      var url = "/_p/cbas/api/v1/samples?sampleName=travel-sample";
      var request = {
        url: url,
        method: "POST",
      };
      $http(request).then(function (response) {
        mnAlertsService.formatAndSetAlerts("Sample loading for 'travel-sample' completed successfully", 'success', 5000);
      }).catch(function (error) {
        console.error('Error loading sample data:', error);
      });
      mnAlertsService.formatAndSetAlerts("Sample loading for 'travel-sample' started", 'success', 5000);
      // TODO: this assumes we only have the one sample
      qsc.samples = [];
    }
  }

  //
  // all done, return the controller
  //

  return qsc;
}

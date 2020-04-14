import _ from "/ui/web_modules/lodash.js";

export default cwCbasMonitorController;

function cwCbasMonitorController ($scope, $timeout, cwQueryService, validateCbasService, mnStatisticsNewService, mnPermissions, qwQueryService) {
  var qmc = this;

  //
  // Do we have a REST API to work with?
  //

  qmc.validated = validateCbasService;

  // should we show active or completed

  qmc.selectTab = cwQueryService.selectMonitoringTab;
  qmc.isSelected = cwQueryService.isMonitoringSelected;
  qmc.cancelQueryById = cancelQueryById;
  qmc.getCancelLabel = getCancelLabel;
  qmc.cancelledQueries = {}; // keep track of user-cancelled queries

  //
  // keep track of results from the server
  //

  qmc.monitoring = cwQueryService.monitoring;
  qmc.stats = {};
  qmc.updatedTime = updatedTime;
  qmc.toggle_update = toggle_update;
  qmc.get_toggle_label = get_toggle_label;
  qmc.get_update_flag = function() {return(cwQueryService.getMonitoringAutoUpdate());}
  qmc.options = cwQueryService.getMonitoringOptions;

  qmc.getLatestStat = getLatestStat;
  qmc.getAverageStat = getAverageStat;

  //
  // sorting for each of the two result tables
  //

  qmc.update_active_sort = function(field) {
    if (qmc.options().active_sort_by == field)
      qmc.options().active_sort_reverse = !qmc.active_sort_reverse;
    else
      qmc.options().active_sort_by = field;

    qwQueryService.saveStateToStorage();
  };
  qmc.show_up_caret_active = function(field) {
    return(qmc.options().active_sort_by == field && qmc.options().active_sort_reverse);
  };
  qmc.show_down_caret_active = function(field) {
    return(qmc.options().active_sort_by == field && !qmc.options().active_sort_reverse);
  };

  qmc.update_completed_sort = function(field) {
    if (qmc.options().completed_sort_by == field)
      qmc.options().completed_sort_reverse = !qmc.options().completed_sort_reverse;
    else
      qmc.options().completed_sort_by = field;

    qwQueryService.saveStateToStorage();
  };
  qmc.show_up_caret_completed = function(field) {
    return(qmc.options().completed_sort_by == field && qmc.options().completed_sort_reverse);
  };
  qmc.show_down_caret_completed = function(field) {
    return(qmc.options().completed_sort_by == field && !qmc.options().completed_sort_reverse);
  };

  //
  // cancel a running query
  //

  function cancelQueryById(requestId) {
    // remember that the query was cancelled
    qmc.cancelledQueries[requestId] = true;
    // do the cancel
    cwQueryService.cancelQueryById(requestId)
      .then(function success() {/*delete qmc.cancelledQueries[requestId];*/},function error() {/*delete qmc.cancelledQueries[requestId];*/});
  }

  //
  // get a label for cancel, which changes when the user hits "cancel"
  //

  function getCancelLabel(requestId) {
    if (qmc.cancelledQueries[requestId])
      return("cancelling...");
    else
      return("Cancel");
  }

  //
  // when was the data last updated?
  //

  function updatedTime() {
    var result;
    switch (cwQueryService.getMonitoringSelectedTab()) {
    case 1: result = qmc.monitoring.active_updated; break
    case 2: result = qmc.monitoring.completed_updated; break;
    }

    if (_.isDate(result)) {
      var minutes = result.getMinutes() > 9 ? result.getMinutes() : "0" + result.getMinutes();
      var seconds = result.getSeconds() > 9 ? result.getSeconds() : "0" + result.getSeconds();
      var dateStr = result.toString();
      var zone = dateStr.substring(dateStr.length-4,dateStr.length-1);
      result = " " + result.getHours() + ":" + minutes + ":" + seconds + " " + zone;
    }

    return result;
  }

  qmc.statsConfig = {
    bucket: mnPermissions.export.bucketNames['.stats!read'] &&
      mnPermissions.export.bucketNames['.stats!read'][0],
    node: "all",
    zoom: 5000,
    step: 1,
    stats: [
      'cbas_disk_used',            // disk used in bytes
      'cbas_gc_count',             // gc/second (i.e., rate)
      'cbas_gc_time',              // ms/sec spent in gc
      'cbas_heap_used',            // heap size in bytes
      'cbas_system_load_average',  //
      'cbas_thread_count'         //
    ]
  };

  //
  // get the latest stat from the server
  //

  function getLatestStat(name) {
    var s = $scope.mnUIStats;
    if (s && s.stats && s.stats[name] && _.isArray(s.stats[name].aggregate)) {
      return(s.stats[name].aggregate.slice(-1)[0]);
    }
    else
      return null;
  }

  //
  // get the average stat from the server
  //

  function getAverageStat(name) {
    var s = $scope.mnUIStats;
    if (s && s.stats && s.stats[name] && _.isArray(s.stats[name].aggregate)) {
      var sum = 0;
      s.stats[name].aggregate.forEach(function(n) {sum+=n});
      return(sum/s.stats[name].aggregate.length);
    }
    else
      return null;
  }

  //
  // call the activate method for initialization
  //

  activate();

  //
  //
  //

  function activate() {
    // get initial data for each panel
    if (qmc.monitoring.active_updated == "never")
      cwQueryService.updateQueryMonitoring(1);
    if (qmc.monitoring.completed_updated == "never")
      cwQueryService.updateQueryMonitoring(2);

    // start auto-updating if necessary

    if (cwQueryService.getMonitoringAutoUpdate())
      update();

    // subscribe to stats
    qmc.statsPoller = mnStatisticsNewService.subscribeUIStatsPoller(qmc.statsConfig,$scope);
  }

  function toggle_update() {
    if (cwQueryService.getMonitoringAutoUpdate()) {
      if (qmc.timer) { // stop any timers
        $timeout.cancel(qmc.timer);
        qmc.timer = null;
      }
      cwQueryService.setMonitoringAutoUpdate(false);
    }
    else {
      cwQueryService.setMonitoringAutoUpdate(true);
      update();
    }
    //qwQueryService.userAutoUpdate = qwQueryService.monitoringAutoUpdate;
  }

  function get_toggle_label() {
    if (cwQueryService.getMonitoringAutoUpdate())
      return("pause");
    else
      return("resume");
  }

  //
  // function to update the current data at regular intervals
  //
  function update() {
    // update the currently selected tab
    cwQueryService.updateQueryMonitoring(cwQueryService.getMonitoringSelectedTab());

    // do it again in 5 seconds
    if (cwQueryService.getMonitoringAutoUpdate()) {
      qmc.timer = $timeout(update,5000);
    }

  }

  // when the controller is destroyed, stop the updates
  $scope.$on('$destroy',function(){
    if (qmc.timer) {
      $timeout.cancel(qmc.timer);
      qmc.timer = null;
    }
  });


  //
  // all done, return the controller
  //

  return qmc;
}

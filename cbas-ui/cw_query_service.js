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
import js_beautify from "js-beautify";
import uiBootstrap from "angular-ui-bootstrap";

import mnPendingQueryKeeper from "components/mn_pending_query_keeper";
import mnPoolDefault from "components/mn_pool_default";
import mnPools from "components/mn_pools";

import cwConstantsService from "../cbas/cw_constants_service.js";
import validateCbasService from "./validate_cbas_service.js";

export default 'cwQueryService';

angular
  .module('cwQueryService', [uiBootstrap, validateCbasService, mnPendingQueryKeeper, cwConstantsService,
                             mnPoolDefault, mnPools, mnPoolDefault])
  .factory('cwQueryService', cwQueryServiceFactory);


cwQueryServiceFactory.$inject = ["$rootScope", "$q", "$uibModal", "$timeout", "$http", "validateCbasService", "mnPendingQueryKeeper", "cwConstantsService", "qwQueryPlanService", "mnPoolDefault", "mnPools", "qwDialogService"];
function cwQueryServiceFactory($rootScope, $q, $uibModal, $timeout, $http, validateCbasService, mnPendingQueryKeeper, cwConstantsService, qwQueryPlanService, mnPoolDefault, mnPools, qwDialogService) {

  var cwQueryService = {};
  mnPools.get().then(function (pools) {cwQueryService.pools = pools;});

  //
  // remember which tab is selected for output style: JSON, table, or tree
  //

  cwQueryService.outputTab = 1;     // remember selected output tab
  cwQueryService.datasetDisconnectedState = -1;
  cwQueryService.datasetUnknownState = -2;
  cwQueryService.externalDatasetState = -3;
  cwQueryService.selectTab = function (newTab) {
    cwQueryService.outputTab = newTab;
  };
  cwQueryService.isSelected = function (checkTab) {
    return cwQueryService.outputTab === checkTab;
  };
  cwQueryService.validated = validateCbasService;

  cwQueryService.atLeast70 = mnPoolDefault.export.compat.atLeast70;
  // analytics monitoring

  var monitoringOptions = {
    selectedTab: 1,
    autoUpdate: true,
    active_sort_by: 'elapsedTime',
    active_sort_reverse: true,
    completed_sort_by: 'elapsedTime',
    completed_sort_reverse: true,
    prepared_sort_by: 'elapsedTime',
    prepared_sort_reverse: true
  };
  cwQueryService.selectMonitoringTab = function (newTab) {
    monitoringOptions.selectedTab = newTab;
    saveStateToStorage();
  };
  cwQueryService.getMonitoringSelectedTab = function () {
    return monitoringOptions.selectedTab;
  };
  cwQueryService.isMonitoringSelected = function (checkTab) {
    return monitoringOptions.selectedTab === checkTab;
  };
  cwQueryService.getMonitoringAutoUpdate = function () {
    return monitoringOptions.autoUpdate;
  };
  cwQueryService.setMonitoringAutoUpdate = function (newValue) {
    monitoringOptions.autoUpdate = newValue;
    saveStateToStorage();
  };
  cwQueryService.getMonitoringOptions = function () {
    return monitoringOptions
  };

  cwQueryService.monitoring = {
    active_requests: active_requests,
    completed_requests: completed_requests,

    active_updated: active_updated,
    completed_updated: completed_updated,
  };

  cwQueryService.updateQueryMonitoring = updateQueryMonitoring;
  cwQueryService.getStats = getStats;

  cwQueryService.showErrorDialog = showErrorDialog;
  cwQueryService.showWarningDialog = showWarningDialog;
  cwQueryService.showConfirmationDialog = showConfirmationDialog;

  var defaultProxyTimeout = 1800; // default ns_server proxy timeout in seconds
  var active_requests = [];
  var completed_requests = [];
  var active_updated = "never"; // last update time
  var completed_updated = "never"; // last update time


  // access to our most recent query result, and functions to traverse the history
  // of different results

  cwQueryService.getResult = function () {
    return lastResult;
  };
  cwQueryService.getCurrentIndexNumber = getCurrentIndexNumber;
  cwQueryService.getCurrentIndex = getCurrentIndex;
  cwQueryService.setCurrentIndex = setCurrentIndex;
  cwQueryService.clearHistory = clearHistory;
  cwQueryService.clearCurrentQuery = clearCurrentQuery;
  cwQueryService.hasPrevResult = hasPrevResult;
  cwQueryService.hasNextResult = hasNextResult;
  cwQueryService.prevResult = prevResult;
  cwQueryService.nextResult = nextResult;
  cwQueryService.addNewQueryAtEndOfHistory = addNewQueryAtEndOfHistory;

  cwQueryService.canCreateBlankQuery = canCreateBlankQuery;

  cwQueryService.getPastQueries = function () {
    return (pastQueries);
  }
  cwQueryService.getQueryHistoryLength = function () {
    return (pastQueries.length);
  }

  cwQueryService.emptyResult = emptyResult;

  //
  // managing links
  //

  cwQueryService.awsRegions = [];
  cwQueryService.createLink = createLink;
  cwQueryService.deleteLink = deleteLink;
  cwQueryService.editLink = editLink;
  cwQueryService.getLink = getLink;
  cwQueryService.getAwsSupportedRegions = getAwsSupportedRegions;
  cwQueryService.getCachedLinkInfo = getCachedLinkInfo;
  cwQueryService.convertAPIdataToDialogScope = convertAPIdataToDialogScope;

  //
  // keep track of the bucket and field names we have seen, for use in autocompletion
  //

  cwQueryService.autoCompleteTokens = {}; // keep a map, name and kind
  cwQueryService.autoCompleteArray = [];  // array for use with Ace Editor

  // execute queries, and keep track of when we are busy doing so

  cwQueryService.executingQuery = {busy: false};
  cwQueryService.currentQueryRequest = null;
  cwQueryService.currentQueryRequestID = null;
  cwQueryService.executeQuery = executeQuery;
  cwQueryService.cancelQuery = cancelQuery;
  cwQueryService.cancelQueryById = cancelQueryById;

  cwQueryService.executeQueryUtil = executeQueryUtil;

  cwQueryService.saveStateToStorage = saveStateToStorage;

  // update store the metadata about buckets

  cwQueryService.buckets = [];
  cwQueryService.bucket_names = [];
  cwQueryService.clusterBuckets = [];
  cwQueryService.shadows = [];
  cwQueryService.indexes = [];
  cwQueryService.dataverses = [];
  cwQueryService.scopeNames = [];
  cwQueryService.dataverse_links = {};
  cwQueryService.links = [];
  cwQueryService.updateBuckets = updateBuckets;             // get list of buckets
  cwQueryService.getSchemaForBucket = getSchemaForBucket;   // get schema
  cwQueryService.testAuth = testAuth; // check passward
  cwQueryService.loadingBuckets = false;
  cwQueryService.planFormat = 'json';
  cwQueryService.fetchingStats = false;
  cwQueryService.isAllowedMultiStatement = isAllowedMultiStatement;
  cwQueryService.showEmptyScopes = true;

  var explainTextFormat = "text";
  var explainJsonFormat = "json";
  var queryApiTextPlanFormat = "STRING";
  var planFormatStartIndex = 8; // "explain (json | text)"
  //    mnAuthService.whoami().then(function (resp) {
  //      if (resp) cwQueryService.user = resp;
  //    });

  // for the front-end, distinguish error status and good statuses

  cwQueryService.status_success = status_success;
  cwQueryService.status_fail = status_fail;

  function status_success() {
    return (lastResult.status == 'success');
  }

  function status_fail() {
    return (lastResult.status == '400' ||
      lastResult.status == 'errors' ||
      lastResult.status == '500' ||
      lastResult.status == '404' ||
      lastResult.status == 'stopped');
  }

  //
  // here are some options we use while querying
  //

  cwQueryService.options = {
    timings: true,
    max_parallelism: "",
    scan_consistency: "not_bounded",
    positional_parameters: [],
    named_parameters: [],
    query_timeout: defaultProxyTimeout
  };

  // clone options so we can have a scratch copy for the dialog box
  cwQueryService.clone_options = function () {
    return {
      timings: cwQueryService.options.timings,
      max_parallelism: cwQueryService.options.max_parallelism,
      scan_consistency: cwQueryService.options.scan_consistency,
      positional_parameters: cwQueryService.options.positional_parameters.slice(),
      named_parameters: cwQueryService.options.named_parameters.slice(),
      query_timeout: cwQueryService.options.query_timeout
    };
  };

  //
  // a few variables for keeping track of the doc editor
  //

  cwQueryService.doc_editor_options = {
    selected_bucket: null,
    query_busy: false,
    limit: 10,
    offset: 0,
    where_clause: '',
    current_query: '',
    current_bucket: '',
    current_result: []
  };

  //
  // this structure holds the current query text, the current query result,
  // and defines the object for holding the query history
  //

  function QueryResult(status, elapsedTime, executionTime, resultCount, resultSize, result,
                       data, query, requestID, explainResult, mutationCount, processedObjects,
                       warningCount, warnings, limitedWarningsCount, queryContext, chart_options) {
    this.status = status;
    this.resultCount = resultCount;
    this.resultCount = mutationCount;
    this.resultSize = resultSize;
    this.processedObjects = processedObjects;
    this.result = result;
    this.data = data;
    this.query = query;
    this.queryContext = queryContext;
    this.requestID = requestID;
    this.explainResult = explainResult;
    if (explainResult)
      this.explainResultText = JSON.stringify(explainResult, null, '  ');
    else
      this.explainResultText = "";

    this.elapsedTime = truncateTime(elapsedTime);
    this.executionTime = truncateTime(executionTime);
    this.warningCount = warningCount;
    this.warnings = warnings;
    this.limitedWarningsCount = limitedWarningsCount;
    this.chart_options = chart_options;
  };

  function getBucketState() {
    var bucketStateRequest = {
      url: cwConstantsService.bucketStateURL,
      method: "GET",
      headers: {'Content-Type': 'application/json', 'ignore-401': 'true'}
    };
    return ($http(bucketStateRequest));
  }

  function getClusterBuckets() {
    var clusterBucketsRequest = {
      url: cwConstantsService.clusterBucketsURL,
      method: "GET",
      headers: {'Content-Type': 'application/json', 'ignore-401': 'true'}
    };
    return ($http(clusterBucketsRequest));
  }

  // elapsed and execution time come back with ridiculous amounts of
  // precision, and some letters at the end indicating units.

  function truncateTime(timeStr) {
    var timeEx = /([0-9.]+)([a-z]+)/i; // number + time unit string

    if (timeStr && timeEx.test(timeStr)) {
      var parts = timeEx.exec(timeStr);
      var num = Number(parts[1]).toFixed(2); // truncate number part
      if (!isNaN(num))
        return (num + parts[2]);
    }

    return (timeStr); // couldn't match, just return orig value
  }

  QueryResult.prototype.clone = function () {
    return new QueryResult(this.status, this.elapsedTime, this.executionTime, this.resultCount,
                           this.resultSize, this.result, this.data, this.query, this.requestID, this.explainResult,
                           this.mutationCount, this.processedObjects, this.warningCount, this.warnings,
                           this.limitedWarningsCount, this.queryContext, this.chart_options
                          );
  };
  QueryResult.prototype.copyIn = function (other) {
    this.status = other.status;
    this.elapsedTime = truncateTime(other.elapsedTime);
    this.executionTime = truncateTime(other.executionTime);
    this.resultCount = other.resultCount;
    this.processedObjects = other.processedObjects;
    this.mutationCount = other.mutationCount;
    this.resultSize = other.resultSize;
    this.result = other.result;
    this.data = other.data;
    this.query = other.query;
    this.requestID = other.requestID;
    this.explainResult = other.explainResult;
    this.explainResultText = other.explainResultText;
    this.warningCount = other.warningCount;
    this.warnings = other.warnings;
    this.limitedWarningsCount = other.limitedWarningsCount;
    this.queryContext = other.queryContext;
    this.chart_options = other.chart_options;
  };

  QueryResult.prototype.set_chart_options = function(new_options) {
    this.chart_options = new_options;
  }

  //
  // structures for remembering queries and results
  //

  var dummyResult = new QueryResult('', '', '', '', '', '', {}, '', '');
  var lastResult = dummyResult.clone();
  var savedResultTemplate = dummyResult.clone();
  savedResultTemplate.status = "cached query";
  savedResultTemplate.result = '{"data_not_cached": "Hit execute to rerun query"}';
  savedResultTemplate.data = {data_not_cached: "Hit execute to rerun query"};
  savedResultTemplate.explainResult = savedResultTemplate.data;
  savedResultTemplate.explainResultText = savedResultTemplate.result;

  var newQueryTemplate = dummyResult.clone();
  newQueryTemplate.status = "Not yet run";
  newQueryTemplate.result = '{"no_data_yet": "Hit execute to run query"}';
  newQueryTemplate.data = {no_data_yet: "Hit execute to run query"};

  var executingQueryTemplate = dummyResult.clone();
  executingQueryTemplate.status = "Executing";
  executingQueryTemplate.result = '{"status": "Executing statement"}';
  executingQueryTemplate.data = {status: "Executing statement"};
  executingQueryTemplate.resultSize = 0;
  executingQueryTemplate.resultCount = 0;
  executingQueryTemplate.processedObjects = 0;
  executingQueryTemplate.warningCount = 0;


  var pastQueries = [];       // keep a history of past queries and their results
  var currentQueryIndex = 0;  // where in the array are we? we start past the
  // end of the array, since there's no history yet

  function emptyResult() {
    return (!pastQueries[currentQueryIndex] ||
      pastQueries[currentQueryIndex].result === savedResultTemplate.result);
  }

  //
  // where are we w.r.t. the query history?
  //

  function getCurrentIndex() {
    return (currentQueryIndex + 1) + "/" + (pastQueries.length == 0 ? 1 : pastQueries.length);
  }

  function getCurrentIndexNumber() {
    return (currentQueryIndex);
  }

  function setCurrentIndex(index) {
    if (index < 0 || index >= pastQueries.length)
      return;

    currentQueryIndex = index;

    $timeout(function () {
      lastResult.copyIn(pastQueries[currentQueryIndex]);
    }, 50);
  }

  //
  // we want to store our state in the browser, if possible
  //

  function supportsHtml5Storage() {
    try {
      return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
      return false;
    }
  }

  var hasLocalStorage = supportsHtml5Storage();
  var localStorageKey = 'CouchbaseQueryWorkbenchState_' + window.location.host
    + cwConstantsService.localStorageSuffix;

  function loadStateFromStorage() {
    // make sure we have local storage

    //console.log("Trying to load from storage...");

    if (hasLocalStorage && _.isString(localStorage[localStorageKey])) try {
      var savedState = JSON.parse(localStorage[localStorageKey]);
      //console.log("Got saved state: " + JSON.stringify(savedState));
      if (savedState.lastResult) {
        //console.log("Got last result: " + JSON.stringify(savedState.lastResult));
        lastResult.copyIn(savedState.lastResult);
        currentQueryIndex = savedState.currentQueryIndex;
        pastQueries = savedState.pastQueries;
        cwQueryService.outputTab = savedState.outputTab;
        if (savedState.options)
          cwQueryService.options = savedState.options;
        if (savedState.doc_editor_options) {
          cwQueryService.doc_editor_options = savedState.doc_editor_options;
        }
      } else
        console.log("No last result");
    } catch (err) {
      console.log("Error loading state: " + err);
    }
  }


  function saveStateToStorage() {
    // nop if we don't have local storage
    if (!hasLocalStorage)
      return;

    // create a structure to hold the current state. To save state we will only
    // save queries, and not their results (which might well exceed the 5MB
    // we have available

    var savedState = {};
    savedState.pastQueries = [];
    savedState.outputTab = cwQueryService.outputTab;
    savedState.currentQueryIndex = currentQueryIndex;
    savedState.lastResult = savedResultTemplate.clone();
    savedState.lastResult.query = lastResult.query;
    savedState.lastResult.queryContext = lastResult.queryContext;
    savedState.options = cwQueryService.options;

    savedState.doc_editor_options = {
      selected_bucket: cwQueryService.doc_editor_options.selected_bucket,
      query_busy: false,
      limit: cwQueryService.doc_editor_options.limit,
      offset: cwQueryService.doc_editor_options.offset,
      where_clause: cwQueryService.doc_editor_options.where_clause,
      current_query: '',
      current_bucket: cwQueryService.doc_editor_options.current_bucket,
      current_result: [] // don't want to save the results - they could be big
    };

    _.forEach(pastQueries, function (queryRes, index) {
      var qcopy = savedResultTemplate.clone();
      qcopy.query = queryRes.query;
      qcopy.queryContext = queryRes.queryContext;
      qcopy.chart_options = queryRes.chart_options;
      savedState.pastQueries.push(qcopy);
    });

    //console.log("saving state, len: " + JSON.stringify(savedState).length);

    // there is no cross browser means to determine how much local
    // storage space is available. When we get an exception, warn the user
    // and let them figure out what to do
    try {
      localStorage[localStorageKey] = JSON.stringify(savedState);
    } catch (e) {
      // if the save failed, notify the user
      showWarningDialog("Warning: Unable to save query history, browser local storage exhausted. You can still run queries, but they won't be saved for future sessions. Try removing large queries from history.")
    }
    //
    //console.log("Saving state to storage: " + JSON.stringify(savedState));
  }

  //
  // functions for adding new tokens and refreshing the token array
  //

  function addToken(token, type) {
    // see if the token needs to be quoted
    if (token.indexOf('`') == -1 &&
      (token.indexOf(' ') >= 0 || token.indexOf('-') >= 0))
      token = '`' + token + '`';

    // if the token isn't already there, add it
    if (!cwQueryService.autoCompleteTokens[token])
      cwQueryService.autoCompleteTokens[token] = type;

    // if the token is already known, but the type is new, add it to the list
    else if (cwQueryService.autoCompleteTokens[token].indexOf(type) == -1)
      cwQueryService.autoCompleteTokens[token] += ", " + type;
  };


  function refreshAutoCompleteArray() {
    cwQueryService.autoCompleteArray.length = 0;

    for (var key in cwQueryService.autoCompleteTokens) {
      //console.log("Got autoCompleteToken key: " + key);
      cwQueryService.autoCompleteArray.push(
        {caption: key, snippet: key, meta: cwQueryService.autoCompleteTokens[key]});
    }
  };


  //
  // go over a schema and recursively put all the field names in our name map
  //

  function getFieldNamesFromSchema(schema, prefix) {
    //console.log("Got schema: " + JSON.stringify(schema, null, 4));
    for (var i = 0; i < schema.length; i++)
      _.forEach(schema[i]['properties'], function (field, field_name) {
        //console.log("Adding field: " + prefix + field_name);
        //console.log("  field[properties]: " + field['properties']);
        //console.log("  field[items]: " + field['items']);
        //if (field['items'])
        // console.log("    field[items].subtype: " + field['items'].subtype);

        addToken(prefix + field_name, "field");
        // if the field has sub-properties, make a recursive call
        if (field['properties']) {
          getFieldNamesFromSchema([field], prefix + field_name + ".");
        }

        // if the field has 'items', it is an array, make recursive call with array type
        if (field['items'] && field['items'].subtype) {
          getFieldNamesFromSchema([field['items'].subtype], prefix + field_name + "[0].");
        } else if (_.isArray(field['items'])) for (var i = 0; i < field['items'].length; i++)
          if (field['items'][i].subtype) {
            getFieldNamesFromSchema([field['items'][i].subtype], prefix + field_name + "[0].");
          }
      });
  }

  //
  // for error checking, it would be nice highlight when a specified field is not found
  // in a given schema
  //

  function isFieldNameInSchema(schema, fieldName) {
    // all schemas have the name "*"
    if (fieldName == "*")
      return true;
    // the field name might be a plain string, it might be suffixed with "[]", and it might
    // have a subfield expression starting with a "."
    var firstDot = fieldName.indexOf(".");
    var fieldPrefix = fieldName.substring(0, (firstDot >= 0 ? firstDot : fieldName.length));
    var fieldSuffix = (firstDot >= 0 ? fieldName.substring(firstDot + 1) : "");
    var arrayIndex = fieldPrefix.indexOf("[");
    if (arrayIndex >= 0)
      fieldPrefix = fieldPrefix.substring(0, fieldPrefix.indexOf("["));

    //console.log("fieldPrefix: *" + fieldPrefix + "* suffix: *" + fieldSuffix + "*");

    for (var i = 0; i < schema.length; i++) // for each flavor
      for (var field_name in schema[i]['properties']) {
        if (field_name == fieldPrefix) { // found a possible match
          if (fieldSuffix.length == 0)  // no subfields? we're done, yay!
            return true;

          var field = schema[i]['properties'][field_name];
          // if we had an array expr, check subfields against the array schema
          if (arrayIndex > -1 && field['items'] && field['items'].subtype &&
            isFieldNameInSchema([field['items'].subtype], fieldSuffix))
            return true;

          // if we have a non-array, check the subschema
          if (arrayIndex == -1 && field['properties'] &&
            isFieldNameInSchema([field], fieldSuffix))
            return true;
        }
      }

    // if we get this far without finding it, return false
    return false;
  }

  //
  // we also keep a history of executed queries and their results
  // we will permit forward and backward traversal of the history
  //

  var tempResult = "Processing";
  var tempData = {status: "processing"};

  //
  // we can create a blank query at the end of history if we're at the last slot, and
  // the query there has already been run
  //

  function canCreateBlankQuery() {
    return (currentQueryIndex == pastQueries.length - 1 &&
      lastResult.query.trim() === pastQueries[pastQueries.length - 1].query.trim() &&
      lastResult.status != newQueryTemplate.status &&
      !cwQueryService.executingQuery.busy);
  }

  function hasPrevResult() {
    return currentQueryIndex > 0;
  }

  // we can go forward if we're back in the history, or if we are at the end and
  // want to create a blank history element
  function hasNextResult() {
    return (currentQueryIndex < pastQueries.length - 1) ||
      canCreateBlankQuery();
  }

  function prevResult() {
    if (currentQueryIndex > 0) // can't go earlier than the 1st
    {
      // if we are going backward from the end of the line, from a query that
      // has been edited but hasn't been run yet, we need to add it to the
      // history

      if (currentQueryIndex === (pastQueries.length - 1) &&
        lastResult.query.trim() !== pastQueries[pastQueries.length - 1].query.trim()) {
        var newResult = newQueryTemplate.clone();
        newResult.query = lastResult.query;
        pastQueries.push(newResult);
        currentQueryIndex++;
      }

      //
      // the following gross hack is due to an angular issue where it doesn't
      // successfully detect *some* changes in the result data, and thus doesn't
      // update the table. So we set the result to blank, then back to a value
      // after a certain delay.
      //

      lastResult.result = tempResult; // blank values
      lastResult.data = tempData;
      currentQueryIndex--;

      return $timeout(function () {
        lastResult.copyIn(pastQueries[currentQueryIndex]);
      }, 50);
    }
  }

  function nextResult() {
    if (currentQueryIndex < pastQueries.length - 1) // can we go forward?
    {

      //
      // see comment above about the delay hack.
      //

      lastResult.result = tempResult; // blank values
      lastResult.data = tempData;
      currentQueryIndex++;

      return $timeout(function () {
        lastResult.copyIn(pastQueries[currentQueryIndex]);
      }, 50);
    }

    // if the end query has been run, and is unedited, create a blank query
    else if (canCreateBlankQuery()) {
      addNewQueryAtEndOfHistory();
    }
  }

  function addNewQueryAtEndOfHistory(query) {
    // if the end of the history is a blank query, add it there.

    if (pastQueries.length > 0 && pastQueries[pastQueries.length - 1].query.length == 0) {
      pastQueries[pastQueries.length - 1].query = query;
    }

    // otherwise, add a new query at the end of history

    else {
      var newResult = newQueryTemplate.clone();
      if (query)
        newResult.query = query;
      else
        newResult.query = "";
      newResult.queryContext = lastResult.queryContext; // use the current context for the blank query
      pastQueries.push(newResult);
    }

    currentQueryIndex = pastQueries.length - 1;
    lastResult.copyIn(pastQueries[currentQueryIndex]);
  }

  //
  // clear the entire query history
  //

  function clearHistory() {
    // don't clear the history if existing queries are already running
    if (cwQueryService.executingQuery.busy)
      return;

    lastResult.copyIn(dummyResult);
    pastQueries.length = 0;
    currentQueryIndex = 0;

    saveStateToStorage(); // save current history
  }

  //
  // clear the current query
  //

  function clearCurrentQuery() {
    // don't clear the history if existing queries are already running
    if (cwQueryService.executingQuery.busy || pastQueries.length == 0)
      return;

    pastQueries.splice(currentQueryIndex, 1);
    if (currentQueryIndex >= pastQueries.length)
      currentQueryIndex = pastQueries.length - 1;

    lastResult.copyIn(pastQueries[currentQueryIndex]);

    saveStateToStorage(); // save current history
  }

  /**
   * Fast UUID generator, RFC4122 version 4 compliant.
   * @author Jeff Ward (jcward.com).
   * @license MIT license
   * @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
   **/
  var UUID = (function () {
    var self = {};
    var lut = [];
    for (var i = 0; i < 256; i++) {
      lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
    }
    self.generate = function () {
      var d0 = Math.random() * 0xffffffff | 0;
      var d1 = Math.random() * 0xffffffff | 0;
      var d2 = Math.random() * 0xffffffff | 0;
      var d3 = Math.random() * 0xffffffff | 0;
      return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
        lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
        lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
        lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
    }
    return self;
  })();

  //
  // cancelQuery - if a query is running, cancel it
  //
  function cancelQuery() {
    if (cwQueryService.currentQueryRequest != null) {
      var queryInFly = mnPendingQueryKeeper.getQueryInFly(cwQueryService.currentQueryRequest);
      queryInFly && queryInFly.canceler("test");

      // prepare cancel request
      var queryIdParam = cwConstantsService.queryIdParam + "=" + cwQueryService.currentQueryRequestID;
      var cancelQueryRequest = {
        url: cwConstantsService.canelQueryURL + "?" + queryIdParam,
        method: "DELETE"
      };

      // submit request
      $http(cancelQueryRequest)
        .then(function success(resp) {
          },
          function error(resp) {
            logWorkbenchError("Error cancelling query: " + JSON.stringif(resp));
          });
    }
  }

  //
  // cancel a query - given its UUID
  //

  function cancelQueryById(request_id) {
    var cancelQueryRequest = {
      url: cwConstantsService.canelQueryURL + '?request_id=' + request_id,
      method: 'DELETE'
    };

    return ($http(cancelQueryRequest));
  }

  //
  // we run queries many places, the following function calls $http to run
  // the query, and returns the promise so the caller can handle success/failure callbacks.
  // queryText - the query to run
  // is_user_query - with user queries, we need to
  //   1) set a client_context_id to allow the query to be cancelled
  //   2) transform responses to handle ints > 53 bits long?
  //   3) set cwQueryService.currentQueryRequestID and qwQueryRequest.currentQueryRequest
  //

  function executeQueryUtil(queryText, is_user_query, highPriority) {
    //console.log("Running query: " + queryText);
    var request = buildQueryRequest(queryText, is_user_query, null, highPriority);

    // if the request can't be built because the query is too big, return a dummy
    // promise that resolves immediately. This needs to follow the angular $http
    // promise, which supports .success and .error as well as .then

    if (!request) {
      var dummy = Promise.resolve({errors: "Query too long"});
      //dummy.success = function(fn) {/*nop*/ return(dummy);};
      //dummy.error = function(fn) {dummy.then(fn); return(dummy);};
      dummy.origThen = dummy.then;
      dummy.then = function (fn1, fn2) {
        dummy.origThen(fn1, fn2);
        return (dummy);
      };
      return (dummy);
    }

    return ($http(request));
  }

  function logWorkbenchError(errorText) {
    $http({
      url: "/logClientError",
      method: "POST",
      data: errorText,
    });
  }

  function buildQueryRequest(queryText, is_user_query, queryOptions, highPriority, queryContext) {

    //console.log("Building query: " + queryText);
    //
    // create a data structure for holding the query, and the credentials for any SASL
    // protected buckets
    //
    var priority = highPriority ? '-1' : '0';
    var extractedQuery = extractExplainPlanFormat(queryText);
    var planFormat = extractedQuery[0];
    queryText = extractedQuery[1];
    var queryData = {statement: queryText};

    if (cwConstantsService.sendCreds) {
      var credArray = [];

      if (!cwQueryService.bucket_errors) for (var i = 0; i < cwQueryService.buckets.length; i++) {
        var pw = cwQueryService.buckets[i].password ? cwQueryService.buckets[i].password : "";
        credArray.push({user: "local:" + cwQueryService.buckets[i].id, pass: pw});
      }

      if (credArray.length > 0) {
        queryData.creds = credArray;
      }
    }
    //console.log("Creds was: " + JSON.stringify(queryData.creds));

    // are there options we need to add to the query request?

    if (queryOptions) {
      if (queryOptions.max_parallelism && queryOptions.max_parallelism.length > 0)
        queryData.max_parallelism = queryOptions.max_parallelism;

      if (queryOptions.scan_consistency)
        queryData.scan_consistency = queryOptions.scan_consistency;

      if (queryOptions.positional_parameters && queryOptions.positional_parameters.length > 0)
        queryData.args = queryOptions.positional_parameters;

      if (queryOptions.named_parameters)
        for (var i = 0; i < queryOptions.named_parameters.length; i++)
          queryData[queryOptions.named_parameters[i].name] = queryOptions.named_parameters[i].value;

      //console.log("Running query: " + JSON.stringify(queryData));
    }

    // if the user might want to cancel it, give it an ID

    if (is_user_query) {
      cwQueryService.currentQueryRequestID = UUID.generate();
      queryData.client_context_id = cwQueryService.currentQueryRequestID;
      queryData["optimized-logical-plan"] = true;
      queryData["plan-format"] = planFormat;
      queryData["max-warnings"] = cwConstantsService.maxWarnings;

      if (queryContext) { // query context has display name
        var dv = cwQueryService.dataverses.find(dv => dv.dataverseDisplayName == queryContext)
        if (dv)
          queryData["query_context"] = 'default:' + dv.dataverseQueryName;
      }
    }

    //
    // build the query request
    //

    var queryRequest;
    var userAgent = 'Couchbase Query Workbench';
    if (mnPoolDefault.export.thisNode && mnPoolDefault.export.thisNode.version)
      userAgent += ' (' + mnPoolDefault.export.thisNode.version + ')';

    if (!_.isNumber(cwQueryService.options.query_timeout) || cwQueryService.options.query_timeout === 0) {
      cwQueryService.options.query_timeout = defaultProxyTimeout;
    }

    queryRequest = {
      url: cwConstantsService.queryURL,
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'ns-server-proxy-timeout': cwQueryService.options.query_timeout * 1000,
        'ignore-401': 'true', 'CB-User-Agent': userAgent, 'Analytics-Priority': priority
      },
      data: queryData,
      mnHttp: {
        isNotForm: true,
        group: "global"
      }
    };

    queryRequest.planFormat = planFormat;

    // if it's a userQuery, make sure to handle really long ints, and remember the
    // request in case we need to cancel

    if (is_user_query) {
      queryRequest.transformResponse = fixLongInts;
      cwQueryService.currentQueryRequest = queryRequest;
    }

    //
    // check the queryRequest to make sure it's not too big
    //

    if (cwConstantsService.maxRequestSize &&
      JSON.stringify(queryRequest).length >= cwConstantsService.maxRequestSize) {
      showErrorDialog("Query too large for GUI, try using CLI or REST API directly.")
      return (null);
    }

    //console.log("Built query: " + JSON.stringify(queryRequest));
    return (queryRequest);
  }

  //
  // convenience function to see if fields mentioned in a query are not found in the schema
  // for the buckets involved
  //

  function getProblemFields(fields) {
    var problem_fields = [];

    for (var f in fields) {
      var firstDot = f.indexOf(".");
      var bucketName = f.substring(0, firstDot);
      var fieldName = f.substring(firstDot + 1);
      //console.log("Checking field: " + f + ", bucket: " + bucketName);
      var bucket = _.find(cwQueryService.buckets, function (b) {
        return (b.id == bucketName);
      });
      if (bucket) {
        //console.log("  Got bucket: " + bucket + ", bucket schema: " + bucket.schema);
        if (bucket && bucket.schema.length > 0 && !isFieldNameInSchema(bucket.schema, fieldName)) {
          problem_fields.push({field: fieldName, bucket: bucket.id});
          //console.log("Field: " + fieldName + "is not o.k.");
        }
      }
    }

    return (problem_fields);
  }

  //
  // executeQuery
  //

  function executeQuery(queryText, userQuery, queryOptions, explainOnly, queryContext) {
    var newResult;

    //console.log("Got query to execute: " + queryText);
    //logWorkbenchError("Got query to execute: " + queryText);

    // if the current query is part of the history,
    // or current query is "not yet run",
    // update the results from the history

    if ((currentQueryIndex < pastQueries.length &&
      lastResult.query.trim() === pastQueries[currentQueryIndex].query.trim()) ||
      (lastResult.status == newQueryTemplate.status)) {
      newResult = executingQueryTemplate.clone();
      newResult.query = lastResult.query.trim();
      newResult.queryContext = lastResult.queryContext;
      newResult.chart_options = lastResult.chart_options;
      pastQueries[currentQueryIndex] = newResult; // forget previous results
    }

      // otherwise, we have a new/edited query, so we create a new empty result
    // at the end of the query history

    else {
      newResult = executingQueryTemplate.clone();
      newResult.query = lastResult.query.trim();
      newResult.queryContext = lastResult.queryContext;
      newResult.chart_options = lastResult.chart_options;
      pastQueries.push(newResult);
      currentQueryIndex = pastQueries.length - 1; // after run, set current result to end
    }

    // don't allow multiple queries, as indicated by anything after a semicolon
    // we test for semicolons in either single or double quotes, or semicolons outside
    // of quotes followed by non-whitespace. That final one is group 1. If we get any
    // matches for group 1, it looks like more than one query.

    if (cwConstantsService.forbidMultipleQueries) {
      var matchNonQuotedSemicolons = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(;\s*\S+)/ig;
      var semicolonCount = 0;

      var matchArray = matchNonQuotedSemicolons.exec(queryText);
      while (matchArray != null) {
        if (matchArray[1]) // group 1, a non-quoted semicolon with non-whitespace following
          semicolonCount++;
        matchArray = matchNonQuotedSemicolons.exec(queryText);
      }

      if (semicolonCount > 0) {
        newResult.status = "errors";
        newResult.data = {error: "Error, you cannot issue more than one query at once. Please remove all text after the semicolon closing the first query."};
        newResult.result = JSON.stringify(newResult.data);
        newResult.explainResult = newResult.data;
        newResult.explainResultText = newResult.result;
        lastResult.copyIn(newResult);
        saveStateToStorage(); // save current history
        return null;
      }
    }

    // don't run new queries if existing queries are already running
    if (cwQueryService.executingQuery.busy)
      return;

    cwQueryService.executingQuery.busy = true;
    lastResult.result = executingQueryTemplate.result;
    lastResult.data = executingQueryTemplate.data;
    lastResult.status = executingQueryTemplate.status;
    lastResult.resultSize = executingQueryTemplate.resultSize;
    lastResult.resultCount = executingQueryTemplate.resultCount;
    lastResult.processedObjects = executingQueryTemplate.processedObjects;
    lastResult.warningCount = executingQueryTemplate.warningCount;
    lastResult.warnings = executingQueryTemplate.warnings;
    lastResult.limitedWarningsCount = executingQueryTemplate.limitedWarningsCount;

    var pre_post_ms = new Date().getTime(); // when did we start?

    //
    // if the query is not already an explain, run a version with explain to get the query plan
    //

    var queryIsExplain = /^\s*explain/gmi.test(queryText);
    var queryIsPrepare = /^\s*prepare/gmi.test(queryText);
    var explain_promise;

    if (!queryIsExplain && !queryIsPrepare && cwConstantsService.autoExplain) {

      newResult.explainDone = false;

      var explain_request = buildQueryRequest("explain " + queryText, false, null, false, queryContext);
      if (!explain_request) {
        newResult.result = '{"status": "Query Failed."}';
        newResult.data = {status: "Query Failed."};
        newResult.status = "errors";
        newResult.resultCount = 0;
        newResult.resultSize = 0;
        newResult.processedObjects = 0;
        newResult.warningCount = 0;
        newResult.queryDone = true;

        // can't recover from error, finish query
        lastResult.copyIn(newResult);
        finishQuery();
        return;
      }
      explain_promise = $http(explain_request)
        .then(function success(resp) {
            var data = resp.data, status = resp.status;

            // now check the status of what came back
            if (data && data.status == "success" && data.results && data.results.length > 0) {
              let lists = qwQueryPlanService.analyzeAnalyticsPlan(data.results[0].plan, null);
              newResult.explainResult =
                {
                  explain: data.results[0],
                  mode: "analytics",
                  analysis: lists,
                  plan_nodes: qwQueryPlanService.convertAnalyticsPlanToPlanNodes(data.results[0].plan, null, lists)
                };

              if (_.isArray(lists.warnings) && lists.warnings.length > 0) {
                newResult.limitedWarningsCount = lists.warnings.length;
                newResult.warnings = JSON.stringify(lists.warnings);
              }

              // let's check all the fields to make sure they are all valid
              var problem_fields = getProblemFields(newResult.explainResult.analysis.fields);
              if (problem_fields.length > 0)
                newResult.explainResult.problem_fields = problem_fields;
            } else if (data.errors) {
              newResult.explainResult = data.errors;
              newResult.explainResult.explain_query = explain_request.data.statement;
            } else
              newResult.explainResult = {'error': 'No server response for explain.'};

            newResult.explainDone = true;

            if (newResult.explainResult.explain)
              newResult.explainResultText = JSON.stringify(newResult.explainResult.explain, null, '  ');
            else
              newResult.explainResultText = JSON.stringify(newResult.explainResult, null, '  ');

            // if we're doing explain only, copy the explain results to the regular results as well

            if (explainOnly) {
              newResult.status = "Explain success";
              newResult.resultSize = null;
              newResult.data = newResult.explainResult;
              newResult.result = newResult.explainResultText;
            }

            // all done

            lastResult.copyIn(newResult);

            // if the query has run and finished already, mark everything as done
            if (newResult.queryDone || explainOnly) {
              finishQuery();
            }
          },
          /* error response from $http */
          function error(resp) {
            var data = resp.data, status = resp.status;
            //console.log("Explain error Data: " + JSON.stringify(data));
            //console.log("Request was: " + JSON.stringify(explain_request));

            //console.log("Explain error Status: " + JSON.stringify(status));
            //console.log("Explain error Headers: " + JSON.stringify(headers));

            if (data && _.isString(data)) {
              newResult.explainResult = {errors: data};
              newResult.explainResult.query_from_user = explain_request.data.statement;
            } else if (data && data.errors) {
              if (data.errors.length > 0)
                data.errors[0].query_from_user = explain_request.data.statement;
              newResult.explainResult = {errors: data.errors};
            } else {
              newResult.explainResult = {errors: "Unknown error getting explain plan"};
              newResult.explainResult.query_from_user = explain_request.data.statement;
            }

            newResult.explainDone = true;
            newResult.explainResultText = JSON.stringify(newResult.explainResult, null, '  ');

            // if we're doing explain only, copy the errors to the regular results as well

            if (explainOnly) {
              newResult.data = newResult.explainResult;
              newResult.result = newResult.explainResultText;
            }

            lastResult.copyIn(newResult);

            //console.log("Explain: " + newResult.explainResult);

            // if the query has run and finished already, mark everything as done
            if (newResult.queryDone || explainOnly) {
              newResult.status = "Explain error";
              finishQuery();
            }
          });

    }

    // if the query already was an explain query, mark the explain query as done
    else {
      newResult.explainDone = true;
      newResult.explainResult = {};
      newResult.explainResultText = "";
    }
    if (!queryIsExplain && explainOnly) {
      queryText = addExplain(queryText);
    }

    //console.log("submitting query: " + JSON.stringify(cwQueryService.currentQueryRequest));

    //
    // Issue the request
    //

    newResult.queryDone = false;

    var request = buildQueryRequest(queryText, true, queryOptions, false, queryContext);

    if (!request) {
      newResult.result = '{"status": "Query Failed."}';
      newResult.data = {status: "Query Failed."};
      newResult.status = "errors";
      newResult.resultCount = 0;
      newResult.resultSize = 0;
      newResult.processedObjects = 0;
      newResult.warningCount = 0;
      newResult.queryDone = true;

      // make sure to only finish if the explain query is also done
      lastResult.copyIn(newResult);
      finishQuery();
      return;
    }
    var promise = $http(request)
      // SUCCESS!
      .then(function success(resp) {
          // make sure to handle any processing errors
          try {
            var data = resp.data, status = resp.status;
            //        console.log("Success Data: " + JSON.stringify(data));
            //        console.log("Success Status: " + JSON.stringify(status));
            //        console.log("Success Headers: " + JSON.stringify(headers));
            //        console.log("Success Config: " + JSON.stringify(config));

            var result; // hold the result, or a combination of errors and result
            var isEmptyResult = (!_.isArray(data.results) || data.results.length == 0);

            // empty result, fill it with errors if any
            if (isEmptyResult) {
              if (data.errors) {
                result = data.errors;
              } else {
                // otherwise show some context, make it obvious that results are empty
                result = {};
                result.results = data.results;
              }
            }
            // non-empty result: use it
            else
              result = data.results;

            if (data.warnings) {
              newResult.limitedWarningsCount = data.warnings.length;
            }
            // if we have results, but also errors, record them in the result's warning object
            if (data.warnings && data.errors)
              newResult.warnings = JSON.stringify(data.warnings, null, 2) + JSON.stringify(data.errors, null, 2);
            else if (data.warnings)
              // if we have results, but also errors, record them in the result's warning object
              newResult.warnings = JSON.stringify(data.warnings, null, 2);
            else if (data.errors)
              newResult.warnings = JSON.stringify(data.errors, null, 2);
            if (data.status == "stopped") {
              result = {status: "Query stopped on server."};
            }

            // if we got no metrics, create a dummy version

            if (!data.metrics) {
              data.metrics = {
                elapsedTime: 0.0,
                executionTime: 0.0,
                resultCount: 0,
                resultSize: "0",
                processedObjects: 0,
                warningCount: 0
              }
            }

            newResult.status = data.status;
            newResult.elapsedTime = data.metrics.elapsedTime;
            newResult.executionTime = data.metrics.executionTime;
            newResult.resultCount = data.metrics.resultCount;
            newResult.processedObjects = data.metrics.processedObjects;
            newResult.warningCount = data.metrics.warningCount;
            if (data.metrics.mutationCount)
              newResult.mutationCount = data.metrics.mutationCount;
            newResult.resultSize = data.metrics.resultSize;
            if (data.rawJSON)
              newResult.result = js_beautify(data.rawJSON, {"indent_size": 2});
            else
              newResult.result = angular.toJson(result, true);
            newResult.data = result;

            var isJsonPlan = request.planFormat === "json";
            var plan = "";
            if (data.plans && data.plans.optimizedLogicalPlan) {
              plan = data.plans.optimizedLogicalPlan;
              newResult.explainResultText = plan;
            }
            if (isJsonPlan) {
              cwQueryService.planFormat = "json";
              newResult.explainResultText = JSON.stringify(plan, null, '  ');
              // convert plan format to QueryPlanService expected format
              var stringPlan = JSON.stringify(plan);
              stringPlan = stringPlan.replace(/\"operator\":/g, '"#operator":');
              plan = JSON.parse(stringPlan, null, '  ');
              var planEntities = qwQueryPlanService.analyzeAnalyticsPlan(plan, null);
              var planNodes = qwQueryPlanService.convertAnalyticsPlanToPlanNodes(plan, null, planEntities);
              newResult.explainResult = {explain: plan, mode: "analytics", analysis: planEntities, plan_nodes: planNodes};
            } else {
              cwQueryService.planFormat = "text";
              cwQueryService.selectTab(5);
            }

            if (explainOnly || queryIsExplain) {
              newResult.result = isJsonPlan ? newResult.explainResultText : "";
            }
            newResult.requestID = data.requestID;

            // did we get query timings in the result? If so, update the plan

            if (data.profile && data.profile.executionTimings) {
              let lists = qwQueryPlanService.analyzeAnalyticsPlan(data.profile.executionTimings, null);
              newResult.explainResult =
                {
                  explain: data.profile.executionTimings,
                  mode: "analytics",
                  analysis: lists,
                  plan_nodes: qwQueryPlanService.convertAnalyticsPlanToPlanNodes(data.profile.executionTimings, null, lists)
                  /*,
                    buckets: cwQueryService.buckets,
                    tokens: cwQueryService.autoCompleteTokens*/
                };
              newResult.explainResultText = JSON.stringify(newResult.explainResult.explain, null, '  ');

              // let's check all the fields to make sure they are all valid
              var problem_fields = getProblemFields(newResult.explainResult.analysis.fields);
              if (problem_fields.length > 0)
                newResult.explainResult.problem_fields = problem_fields;
            }

            newResult.queryDone = true;

            // if this was an explain query, change the result to show the
            // explain plan

            if (queryIsExplain && cwConstantsService.autoExplain) {
              let lists = qwQueryPlanService.analyzeAnalyticsPlan(data.results[0].plan, null);
              newResult.explainResult =
                {
                  explain: data.results[0],
                  mode: "analytics",
                  analysis: lists,
                  plan_nodes: qwQueryPlanService.convertAnalyticsPlanToPlanNodes(data.results[0].plan, null, lists)
                  /*,
                    buckets: cwQueryService.buckets,
                    tokens: cwQueryService.autoCompleteTokens*/
                };
              newResult.explainResultText = JSON.stringify(newResult.explainResult.explain, null, '  ');
              cwQueryService.selectTab(4); // make the explain visible
            }

            // make sure to only finish if the explain query is also done
            if (newResult.explainDone) {
              //console.log("Query done, got explain: " + newResult.explainResultText);

              lastResult.copyIn(newResult);
              finishQuery();
            }
          }
            // got some error in processing
          catch (e) {
            newResult.result = '{\n  "status": "Internal Query Processing Error."\n}';
            newResult.data = {status: "Query Failed."};
            console.log("Internal query processing error: " + JSON.stringify(e))
            newResult.status = "errors";
            newResult.resultCount = 0;
            newResult.resultSize = 0;
            newResult.processedObjects = 0;
            newResult.warningCount = 0;
            newResult.queryDone = true;

            // make sure to only finish if the explain query is also done
            lastResult.copyIn(newResult);
            finishQuery();
            return;
          }
        },
        /* error response from $http */
        function error(resp) {
          var data = resp.data, status = resp.status;
          //      console.log("Error Data: " + JSON.stringify(data));
          //      console.log("Request was: " + JSON.stringify(request));
          //      console.log("Error Status: " + JSON.stringify(status));
          //      console.log("Error Headers: " + JSON.stringify(headers));
          //console.log("Error Config: " + JSON.stringify(config));

          // if we don't get query metrics, estimate elapsed time
          if (!data || !data.metrics) {
            var post_ms = new Date().getTime();
            newResult.elapsedTime = (post_ms - pre_post_ms) + "ms";
            newResult.executionTime = newResult.elapsedTime;
          }

          // no result at all? failure
          if (data === undefined) {
            newResult.result = '{"status": "Failure contacting server."}';
            newResult.data = {status: "Failure contacting server."};
            newResult.status = "errors";
            newResult.resultCount = 0;
            newResult.resultSize = 0;
            newResult.processedObjects = 0;
            newResult.warningCount = 0;
            newResult.queryDone = true;

            // make sure to only finish if the explain query is also done
            if (newResult.explainDone) {
              lastResult.copyIn(newResult);
              // when we have errors, don't show theh plan tabs
              if (cwQueryService.isSelected(4) || cwQueryService.isSelected(5))
                cwQueryService.selectTab(1);
              finishQuery();
            }
            return;
          }

          // data is null? query interrupted
          if (data === null) {
            newResult.result = '{"status": "Query interrupted."}';
            newResult.data = {status: "Query interrupted."};
            newResult.status = "errors";
            newResult.resultCount = 0;
            newResult.resultSize = 0;
            newResult.processedObjects = 0;
            newResult.warningCount = 0;
            newResult.queryDone = true;

            // make sure to only finish if the explain query is also done
            if (newResult.explainDone) {
              lastResult.copyIn(newResult);
              // when we have errors, don't show theh plan tabs
              if (cwQueryService.isSelected(4) || cwQueryService.isSelected(5))
                cwQueryService.selectTab(1);
              finishQuery();
            }
            return;
          }

          // result is a string? it must be an error message
          if (_.isString(data)) {
            newResult.data = {status: status, message: data};
            if (status && status === 504) {
              newResult.data.status_detail =
                "The Analytics workbench only supports queries running for " + cwQueryService.options.query_timeout
                + " seconds. This value can be changed in the preferences dialog. You can also use cbq from the " +
                "command-line for longer running queries.";
            }

            newResult.result = JSON.stringify(newResult.data, null, '  ');
            newResult.status = "errors";
            newResult.queryDone = true;

            // make sure to only finish if the explain query is also done
            if (newResult.explainDone) {
              lastResult.copyIn(newResult);
              // when we have errors, don't show theh plan tabs
              if (cwQueryService.isSelected(4) || cwQueryService.isSelected(5))
                cwQueryService.selectTab(1);
              finishQuery();
            }
            return;
          }

          if (data.errors) {
            if (_.isArray(data.errors) && data.errors.length >= 1) {
              if (userQuery)
                data.errors[0].query_from_user = userQuery;
              //data.errors[0].query_with_limit = queryText;
            }
            newResult.data = data.errors;
            newResult.result = JSON.stringify(data.errors, null, '  ');
          }

          if (status)
            newResult.status = status;
          else
            newResult.status = "errors";

          if (data.metrics) {
            newResult.elapsedTime = data.metrics.elapsedTime;
            newResult.executionTime = data.metrics.executionTime;
            newResult.resultCount = data.metrics.resultCount;
            if (data.metrics.mutationCount)
              newResult.mutationCount = data.metrics.mutationCount;
            newResult.resultSize = data.metrics.resultSize;
            newResult.processedObjects = data.metrics.processedObjects;
            if (data.metrics.warningCount)
              newResult.warningCount = data.metrics.warningCount;
          }

          if (data.requestID)
            newResult.requestID = data.requestID;

          newResult.queryDone = true;

          // make sure to only finish if the explain query is also done
          if (newResult.explainDone) {
            lastResult.copyIn(newResult);
            // when we have errors, don't show theh plan tabs
            if (cwQueryService.isSelected(4) || cwQueryService.isSelected(5))
              cwQueryService.selectTab(1);
            finishQuery();
          }
        });

    return (promise);

  }

  //
  // whenever a query finishes, we need to set the state to indicate teh query
  // is not longer running.
  //

  function finishQuery() {
    saveStateToStorage();                       // save the state
    cwQueryService.currentQueryRequest = null;  // no query running
    cwQueryService.executingQuery.busy = false; // enable the UI
  }

  //
  // whenever the system changes, we need to update the list of valid buckets
  //

  $rootScope.$on("bucketUriChanged", updateBuckets);
  $rootScope.$on("pollAnalyticsShadowingStats", pollAnalyticsShadowingStats);

  function updateBuckets(event, data) {
    validateCbasService.checkLiveness(updateBucketsCallback);
  }

  function updateBucketsCallback() {
    cwQueryService.loadingBuckets = true;
    var queryText = cwConstantsService.keyspaceQuery;
    if (!mnPoolDefault.export.compat.atLeast70)
      queryText = cwConstantsService.keyspaceQuery6_6;
    // run a query to get the dataverse, link, and dataset info from Metadata
    executeQueryUtil(queryText, false, true)
      .then(function (resp) {
        processMetadataQueryResult(resp.data);
        return validateCbasService.userHasAnyBuckets() ? getClusterBuckets() : null;
      })
      .then(function (resp) {
        if (resp) {
          processClusterBuckets(resp.data);
        }
        return getAnalyticsShadowingStats(true);
      })
      .catch(function (err) {
        console.log("Error: " + JSON.stringify(err));
        var error = "Failed to get bucket insights.";
        error = error + "\nTry refreshing the bucket insights.";
        cwQueryService.buckets.length = 0;
        cwQueryService.shadows.length = 0;
        cwQueryService.clusterBuckets.length = 0;
        cwQueryService.dataverses.length = 0;
        cwQueryService.scopeNames.length = 0;
        cwQueryService.dataverse_links = {};
        cwQueryService.autoCompleteTokens = {};
        cwQueryService.bucket_errors = error;
        logWorkbenchError(error);
      })
      .finally(function () {
        cwQueryService.loadingBuckets = false;
      });

    // we need more details about links, however, so use the REST API to get that also
     $http({
       url: "/_p/cbas/analytics/link",
       headers: {'Content-Type': 'application/json', 'ignore-401': 'true', 'Analytics-Priority': '-1'},
       method: "GET",
     }).then(function success(resp) {
       if (resp && resp.data && _.isArray(resp.data)) {
         cwQueryService.links = resp.data;
         //console.log(resp.data);
       } else
         cwQueryService.links = [];
     });

  }

  function processMetadataQueryResult(data) {
    // initialize the data structure for holding all the buckets and shadows
    cwQueryService.buckets.length = 0;
    cwQueryService.shadows.length = 0;
    cwQueryService.dataverses.length = 0;
    cwQueryService.scopeNames.length = 0;
    cwQueryService.clusterBuckets.length = 0;
    cwQueryService.bucket_errors = null;
    cwQueryService.bucket_names.length = 0;
    cwQueryService.dataverse_links = {};
    // thanks to an 'order by' clause, we can count on the dataverses to show up first, then links, then datasets
    if (data && data.results) {
      for (var i = 0; i < data.results.length; i++) {
        var record = data.results[i];

        // dataverses
        if (record.isDataverse) {
          record.multiPartName = record.DataverseName.indexOf('/') >= 0;
          record.dataverseDisplayName = record.DataverseName.split('/').join('.');
          record.dataverseQueryName = '`' + record.DataverseName.split('/').join('`.`') + '`';
          cwQueryService.dataverses.push(record);
          cwQueryService.scopeNames.push(record.dataverseDisplayName);
          cwQueryService.dataverse_links[record.DataverseName] = []; // list of links
          addToken(record.dataverseQueryName, "scope");
        }

        // links
        else if (record.isLink) {
          var linkType = (!record.LinkType || record.LinkType == "COUCHBASE") ? "INTERNAL" : "EXTERNAL";
          var dataverse = cwQueryService.dataverses.find(dv => dv.DataverseName == record.DataverseName);
          theLink = {LinkName: record.Name, DVName: record.DataverseName, LinkType: linkType,
            IsActive: record.IsActive, extLinkType: record.LinkType, dataverse: dataverse};
          if (theLink.LinkType == "EXTERNAL") theLink.IsActive = true; // external links can't be unlinked
          // make sure the link has a known dataverse, to avoid problem from MB-46165
          if (cwQueryService.dataverse_links[record.DataverseName])
            cwQueryService.dataverse_links[record.DataverseName].push(theLink);
          addToken(record.Name, "link");
        }

        // datasets
        else if (record.isDataset) {
          record.expanded = true;
          if (record.DatasetType === "INTERNAL") {
            record.external = false;
            record.remaining = cwQueryService.datasetUnknownState;
            constructIndexesKeys(record);
            addToken(record.id, "collection");
          } else if (record.DatasetType === "EXTERNAL") {
            record.external = true;
            record.remaining = cwQueryService.externalDatasetState;
            parseExternalDetails(record);
            addToken(record.id, "collection");
          } else if (record.DatasetType === "VIEW") {
            // views are part of a dataverse but not a link
            var dataverse = cwQueryService.dataverses.find(dv => dv.DataverseName == record.DataverseName);
            dataverse.views = dataverse.views || [];
            dataverse.views.push(record);
            record.external = false;
            record.view = true;
            addToken(record.id, "view");
          }
          record.multiPartName = record.DataverseName.indexOf('/') >= 0;
          record.dataverseDisplayName = record.DataverseName.split('/').join('.');
          record.dataverseQueryName = '`' + record.DataverseName.split('/').join('`.`') + '`';
          cwQueryService.shadows.push(record);

          // every non-view dataset is part of a dataverse, but it can use a link from another
          // dataverse. Thus we must keep track of all the links used by any dataset in
          // the dataverse, even if the link is in another dataverse.
          if (record.DatasetType != "VIEW") {
            var theLink = cwQueryService.dataverse_links[record.DataverseName]
                .find(link => link.LinkName == record.LinkName && link.DVName == record.linkDataverseName);
            if (theLink == null) { // link isn't recorded in this dataverse yet, look for it in link's dataverse
              theLink = cwQueryService.dataverse_links[record.linkDataverseName].find(link => link.LinkName == record.LinkName);
              if (theLink)
                cwQueryService.dataverse_links[record.DataverseName].push(theLink);
            }

            // be able to access the link from the shadow record
            record.link = theLink;
            theLink.remaining = record.remaining;
          }
        }
      }
    }
    // put datasets in alphabetical order
    cwQueryService.shadows.sort((a,b) => a.id ? a.id.localeCompare(b.id) : -1);
    // put the fully qualified datasets in as auto-completion
    cwQueryService.shadows.forEach(shadow => addToken(shadow.dataverseQueryName + '.`' + shadow.id + '`',"path"));
    // we want the Local scope to always come first in each scope
    for (var dataverseName in cwQueryService.dataverse_links) {
      var links = cwQueryService.dataverse_links[dataverseName];
      links.sort((a,b) => {
        if (!a.LinkName || a.LinkName == "Local") return -1;
        else if (!b.LinkName || b.LinkName == "Local") return 1;
        else return a.LinkName.localeCompare(b.LinkName)
      });
    }
    // want menu of scope names in order
    cwQueryService.scopeNames.sort();
    // sort the dataverses by name, and add everything to the automcomplete index
    cwQueryService.dataverses.sort((a,b) =>
      a.DataverseName ? a.DataverseName.localeCompare(b.DataverseName) : -1);
    refreshAutoCompleteArray();
  }

  function processClusterBuckets(data) {
    for (var i = 0; i < data.length; i++) {
      var bucketName = data[i].name;
      cwQueryService.clusterBuckets.push(bucketName);
    }
  }

  function constructIndexesKeys(dataset) {
    if (dataset.indexes && dataset.indexes.length > 0) {
      for (var i = 0; i < dataset.indexes.length; i++) {
        var idx = dataset.indexes[i];
        idx.keys = [];
        for (var j = 0; j < idx.SearchKey.length; j++) {
          if (idx.SearchKeyType) {
            idx.keys.push(idx.SearchKey[j] + ":" + idx.SearchKeyType[j]);
          } else {
            idx.keys.push(idx.SearchKey[j]);
          }
        }
      }
    }
  }

  function parseExternalDetails(dataset) {
    if (dataset.externalDetails && dataset.externalDetails.length > 0) {
      for (let i = 0; i < dataset.externalDetails.length; i++) {
        const property = dataset.externalDetails[i];
        // the external property 'name' should be renamed 'LinkName'
        // and likewise 'dataverse' should be 'linkDataverseName'
        switch (property.Name) {
          case 'name': property.Name = 'LinkName'; break;
          case 'dataverse': property.Name = 'linkDataverseName'; break;
        }

        dataset[property.Name] = property.Value;
      }
    }
  }

  function extractExplainPlanFormat(queryText) {
    var planFormat = explainJsonFormat;
    var explainIndex = getExplainIndex(queryText);
    if (explainIndex >= 0) {
      if (hasPlanFormat(queryText, explainIndex, explainJsonFormat)) {
        queryText = removeExplainPlanFormat(queryText, explainIndex, explainJsonFormat);
      } else if (hasPlanFormat(queryText, explainIndex, explainTextFormat)) {
        queryText = removeExplainPlanFormat(queryText, explainIndex, explainTextFormat);
        planFormat = queryApiTextPlanFormat;
      }
    }
    return [planFormat, queryText];
  }

  function getExplainIndex(queryText) {
    var statements = queryText.split(";");
    for (var i = 0; i < statements.length; i++) {
      var statement = statements[i].trim();
      if (statement.length === 0) {
        continue;
      }
      if (!isAllowedMultiStatement(statement)) {
        var match = /^\s*explain/gmi.exec(statement);
        if (match) {
          return queryText.indexOf(statement);
        }
      }
    }
    return -1;
  }

  function addExplain(queryText) {
    var statements = queryText.split(";");
    for (var i = 0; i < statements.length; i++) {
      var statement = statements[i].trim();
      if (statement.length === 0) {
        continue;
      }
      if (!isAllowedMultiStatement(statement)) {
        queryText = queryText.replace(statement, "explain " + statement);
        break;
      }
    }
    return queryText;
  }

  function hasPlanFormat(queryText, explainIndex, format) {
    return queryText.toLowerCase().indexOf(format, explainIndex) === explainIndex + planFormatStartIndex;
  }

  function removeExplainPlanFormat(queryText, explainIndex, format) {
    return queryText.substring(0, explainIndex) + " explain " + queryText.substring(explainIndex + planFormatStartIndex + format.length);
  }

  function isAllowedMultiStatement(statement) {
    var statementLowerCase = statement.toLowerCase();
    return _.startsWith(statementLowerCase, "use ") || _.startsWith(statementLowerCase, "set ");
  }

  function pollAnalyticsShadowingStats() {
    getAnalyticsShadowingStats(false);
  }

  function getAnalyticsShadowingStats(force) {
    if (!validateCbasService.canAccessStats() || (cwQueryService.fetchingStats && !force)) {
      return;
    }
    cwQueryService.fetchingStats = true;
    var stats = getAnalyticsStats();
    if (stats) stats.then(function (resp) {
      var shadowsStats = extractShadowingStats(resp.data);
      updateDatasetShadowingProgress(shadowsStats);
    }, function (resp) {
      // ignore stats failure, will be retried
    }).finally(function () {
      cwQueryService.fetchingStats = false;
    });
  }

  function getAnalyticsStats() {
    if (!mnPoolDefault.export.compat.atLeast70)
      return(null);
    var statsRequest = {
      url: cwConstantsService.analyticsStatsURL,
      method: "GET",
      headers: {'Content-Type': 'application/json', 'ignore-401': 'true', 'Analytics-Priority': '-1'}
    };
    return ($http(statsRequest));
  }

  function extractShadowingStats(statsJson) {
    let collectionsStats = {};
    if ('links' in statsJson) {
      let links = statsJson['links'];
      for (let i = 0; i < links.length; i++) {
        let linkStates = links[i];
        if ('state' in linkStates) {
          parseLinkStates(linkStates, collectionsStats);
        }
      }
    }
    return collectionsStats;
  }


  function parseLinkStates(linkStates, collectionsStats) {
      let states = linkStates['state'];
      for (let i = 0; i < states.length; i++) {
        let state = states[i];
        parseState(state, collectionsStats);
      }
  }

  function parseState(state, collectionsStats) {
    if ('scopes' in state) {
      let scopes = state['scopes'];
      let ingestionState = { "progress": round(state.progress * 100, 1), "timeLag" : timeForHumans(state.timeLag)};
      for (let i = 0; i < scopes.length; i++) {
        let scopeName = scopes[i].name;
        let collections = scopes[i].collections;
        for(let j = 0; j < collections.length; j++) {
          collectionsStats[scopeName + "." + collections[j].name] = ingestionState;
        }
      }
    }
  }

  function timeForHumans(millis) {
    if(!millis) {
      return null;
    }
    try {
      var seconds = millis / 1000;
      var levels = [
        [Math.floor(seconds / 31536000), 'years'],
        [Math.floor((seconds % 31536000) / 86400), 'd'],
        [Math.floor(((seconds % 31536000) % 86400) / 3600), 'h'],
        [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'm'],
        [Math.floor((((seconds % 31536000) % 86400) % 3600) % 60), 's'],
      ];
      var returntext = '';
      for (var i = 0, max = levels.length; i < max; i++) {
        if ( levels[i][0] === 0 ) continue;
        returntext += ' ' + levels[i][0] + levels[i][1];
      }
      return returntext.trim();
    } catch (e) {
      logWorkbenchError("failed to get human readable time from " + millis + " error " + e);
      return null;
    }
  }

  function updateDatasetShadowingProgress(shadowingStats) {
    for (var i = 0; i < cwQueryService.shadows.length; i++) {
      var shadow = cwQueryService.shadows[i];
      if (!shadow.external) {
        if (shadowingStats.hasOwnProperty(shadow.datasetFullyQualifiedName)) {
          var collectionStats = shadowingStats[shadow.datasetFullyQualifiedName];
          if (collectionStats != null) {
            shadow.progress = collectionStats.progress;
            shadow.timeLag = collectionStats.timeLag;
            shadow.remaining = shadow.progress === 100 ? 0 : 1;
            if (shadow.link)
              shadow.link.remaining = shadow.remaining;
            continue;
          }
        }
        shadow.remaining = cwQueryService.datasetDisconnectedState;
        if (shadow.link)
          shadow.link.remaining = shadow.remaining;
      }
    }
  }

  function round(value, precision) {
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
  }

  //
  // this method uses promises and recursion to get the schemas for a list of
  // buckets in sequential order, waiting for each one before moving on to the next.
  // the first thing we do is get the count of documents in the bucket. This might
  // return an authentication error, meaning that the bucket is locked to us. Once
  // we have the count information, and validate access, we get the schema for the bucket
  //

  function getInfoForBucketBackground(bucketList, currentIndex) {
    // if we've run out of buckets, nothing more to do
    if (currentIndex < 0 || currentIndex >= bucketList.length)
      return;

    //console.log("Getting info for: " + bucketList[currentIndex].id);

    testAuth(bucketList[currentIndex],
      function () { // authentication succeeded, get the schema for the bucket
        var res = getSchemaForBucket(bucketList[currentIndex]);
        if (res && res.then)
          res.then(function successCallback(response) {
            getInfoForBucketBackground(bucketList, currentIndex + 1);
          }, function errorCallback(response) {
            getInfoForBucketBackground(bucketList, currentIndex + 1);
          });
      },
      function () { // authentication failed, just move on to the next bucket
        getInfoForBucketBackground(bucketList, currentIndex + 1);
      });
  }


  //
  // test authentication for a bucket by asking for the document count, if no permissions error 10000 comes back
  //

  function testAuth(bucket, success, failure) {
    // start by getting the document count for each bucket
    let queryText = "select count(*) cnt from `" + bucket.id + '`';

    let res1 = executeQueryUtil(queryText, false, false)
      .then(function successCallback(resp) {
          var data = resp.data, status = resp.status;

          // data might have a result array with an object {cnt: <count> }
          if (data && _.isArray(data.results) && data.results.length > 0 && _.isNumber(data.results[0].cnt)) {
            bucket.count = data.results[0].cnt;
            success();
          }

          // data might have authorization error
          else if (data.errors && _.isArray(data.errors) && data.errors.length > 0 && data.errors[0].code == 10000) {
            bucket.passwordNeeded = true;
            failure();
          }
        },

        // error status from query about indexes
        function errorCallback(resp) {
          var data = resp.data, status = resp.status;
          // auth errors come back here
          if (data && data.errors && _.isArray(data.errors) && data.errors.length > 0 && data.errors[0].code == 10000) {
            bucket.passwordNeeded = true;
            failure();
          }
        });
  }

  //
  // Get a schema for a given, named bucket.
  //

  function getSchemaForBucket(bucket) {

    // schema inferencing only in enterprise

    if (!mnPools.export.isEnterprise) {
      bucket.schema_error = "Enterprise Edition needed for Schema inferencing.";
      return;
    }

    //console.log("Getting schema for : " + bucket.id);

    //return $http(inferQueryRequest)
    return executeQueryUtil("infer `" + bucket.id + "`;", false, false)
      .then(function successCallback(response) {
        //console.log("Done with schema for: " + bucket.id);
        //console.log("Schema status: " + status);
        //console.log("Schema data: " + JSON.stringify(response.data));

        bucket.schema.length = 0;

        if (!response || !response.data)
          bucket.schema_error = "Empty or invalid server response: ";
        else if (response.data.errors) {
          bucket.schema_error = "Unable to get schema: " + JSON.stringify(response.data.errors);
        } else if (response.data.status == "stopped") {
          bucket.schema_error = "Unable to get schema, query stopped on server.";
        } else if (response.data.status != "success") {
          bucket.schema_error = "Unable to get schema: " + response.data.status;
        } else if (_.isString(response.data.results))
          bucket.schema_error = response.data.results;
        else {
          //console.log("Got schema: " + JSON.stringify(response.data.results));
          bucket.schema = response.data.results[0];

          var totalDocCount = 0;
          for (var i = 0; i < bucket.schema.length; i++)
            totalDocCount += bucket.schema[i]['#docs'];

          getFieldNamesFromSchema(bucket.schema, "");
          getFieldNamesFromSchema(bucket.schema, bucket.name);
          refreshAutoCompleteArray();

          //console.log("for bucket: " + bucket.name + " got doc count: " + totalDocCount)
          bucket.totalDocCount = totalDocCount;

          for (var i = 0; i < bucket.schema.length; i++)
            bucket.schema[i]['%docs'] = (bucket.schema[i]['#docs'] / totalDocCount * 100);

          // we have an array of columns that are indexed. Let's mark the individual
          // fields, now that we have a schema.
          bucket.indexed_fields = {};

          // each element of the sec_ind array is an array of field names, turn into a map
          _.forEach(bucket.sec_ind, function (elem) {
            _.forEach(elem, function (field) {
              // for now we can't handle objects inside arrays, so we'll just flag the
              // array field as having an index. Also, we need to remove any parens.
              var bracket = field.indexOf('[');
              if (bracket >= 0)
                field = field.substring(0, bracket);

              field = field.replace(/\(/g, '').replace(/\)/g, '');

              //console.log("Index on: " + field);
              bucket.indexed_fields[field] = true;
            })
          });

          for (var flavor = 0; flavor < bucket.schema.length; flavor++) { // iterate over flavors
            markIndexedFields(bucket.indexed_fields, bucket.schema[flavor], "");
            bucket.schema[flavor].hasFields = Object.keys(bucket.schema[flavor].properties).length > 0;
          }

          if (bucket.schema.length)
            bucket.schema.unshift({
              Summary: "Summary: " + bucket.schema.length + " flavors found, sample size " + totalDocCount + " documents",
              hasFields: true
            });
        }

      }, function errorCallback(response) {
        var error = "Error getting schema for bucket: " + bucket.id;
        if (response)
          if (response.data && response.data.errors) {
            error += ", " + JSON.stringify(response.data.errors, null, '  ');
            bucket.schema_error = response.data.errors;
          } else if (response.status)
            error += ", " + response.status;
          else
            error += JSON.stringify(response);

        console.log("   error: " + error);
      });

  };

  //
  // When we get the schema, we need to mark the indexed fields. We start at the top
  // level, but recursively traverse any subtypes, keeping track of the path that we
  // followed to get to the subtype.
  //

  function markIndexedFields(fieldMap, schema, path) {
    //console.log("marking schema size: "+schema.fields.length + " with path: " + path);

    _.forEach(schema['properties'], function (theField, field_name) {
      // in the list of indexed fields, the field names are quoted with back quotes
      var quoted_field_name = '`' + field_name + '`';
      if (path.length > 0)
        quoted_field_name = path + quoted_field_name;

      //console.log(" checking field: " + quoted_field_name);

      // are we in the index map?
      if (fieldMap[quoted_field_name]) {
        theField.indexed = true;
      }

      // do we have a subtype to traverse?
      if (theField.properties)
        markIndexedFields(fieldMap, theField, path + '`' + field_name + '`.');
    });
  };


  //
  // javascript can't handle long ints - any number more than 53 bits cannot be represented
  // with perfect precision. yet the JSON format allows for long ints. To avoid rounding errors,
  // we will search returning data for non-quoted long ints, and if they are found,
  // 1) put the raw bytes of the result into a special field, so that the JSON editor can
  //    show long ints as they came from the server
  // 2) convert all long ints into quoted strings, so they appear properly in the table and tree
  //    views
  //

  function fixLongInts(rawBytes) {
    if (!rawBytes)
      return rawBytes;

    var matchNonQuotedLongInts = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|([:\s]\-?[0-9]{16,})[,\s}]|([:\s]\-?[0-9\.]{17,})[,\s}]/ig;
    var longIntCount = 0;
    var matchArray = matchNonQuotedLongInts.exec(rawBytes);
    while (matchArray != null) {
      if (matchArray[1]) // group 1, a non-quoted long int
        longIntCount++;
      matchArray = matchNonQuotedLongInts.exec(rawBytes);
    }

    //console.log("Got response, longIntcount: " + longIntCount + ", raw bytes: " + rawBytes);

    // if no long ints, just return the original bytes parsed

    if (longIntCount == 0) try {
      return (JSON.parse(rawBytes));
    } catch (e) {
      return (rawBytes);
    }

    // otherwise copy the raw bytes, replace all long ints in the copy, and add the raw bytes as a new field on the result
    else {
      matchNonQuotedLongInts.lastIndex = 0;
      matchArray = matchNonQuotedLongInts.exec(rawBytes);
      //console.log("Old raw: " + rawBytes);
      var result = JSON.parse(rawBytes);
      var newBytes = "";
      var curBytes = rawBytes;

      while (matchArray != null) {
        if (matchArray[1]) { // group 1, a non-quoted long int
          //console.log("  Got longInt: " + matchArray[1] + " with lastMatch: " + matchNonQuotedLongInts.lastIndex);
          //console.log("  remainder: " + rawBytes.substring(matchNonQuotedLongInts.lastIndex));
          var matchLen = matchArray[1].length;
          newBytes += curBytes.substring(0, matchNonQuotedLongInts.lastIndex - matchLen - 1) + '"' +
            matchArray[1] + '"';
          curBytes = curBytes.substring(matchNonQuotedLongInts.lastIndex - 1);
          matchNonQuotedLongInts.lastIndex = 0;
        }
        matchArray = matchNonQuotedLongInts.exec(curBytes);
      }
      newBytes += curBytes;
      //console.log("New raw: " + newBytes);
      result = JSON.parse(newBytes);

      // see if we can pull just the result out of the rawBytes
      var rawResult = findResult(rawBytes);

      if (rawResult)
        result.rawJSON = '\t' + rawResult;
      else
        result.rawJSON = rawBytes;

      return result;
    }
  }

  //
  // getRawResultsFromBytes
  //
  // there's a lot of stuff coming back with query results, but we want only the
  // results themselves. With long numbers, we have to pull those results out of
  // the raw bytes without parsing them.
  //

  function findResult(buffer) {
    // the stuff coming back from the server is a JSON object: "{" followed by
    // quoted field names, ":", and a JSON value (which is recursive). Since we want
    // to find the results without parsing, find the "results: " key, then figure
    // out where it ends.

    var curLoc = 0;
    var whitespace = /\s/;
    var len = buffer.length;

    while (curLoc < len && whitespace.test(buffer.charAt(curLoc))) curLoc++; // ignore whitespace

    if (curLoc >= len && buffer.charAt(curLoc) != '{')
      return null; // expect object start
    else
      curLoc++;

    // loop through each field/value until we see a close brace

    while (curLoc < len) {
      // past the opening of the object, now look for quoted field names followed by ":"
      while (curLoc < len && whitespace.test(buffer.charAt(curLoc))) curLoc++; // ignore whitespace

      if (curLoc >= len || buffer.charAt(curLoc) != '"') // expect open quote
        return null; // expect field name start, otherwise we are done
      else
        curLoc++;

      var fieldStart = curLoc++;
      curLoc = moveToEndOfString(buffer, curLoc);
      if (curLoc >= len) return (null); //make sure we didn't go off the end

      var fieldName = buffer.substring(fieldStart, curLoc);
      //console.log("Got field: " + fieldName);

      var valueStart = curLoc + 3;
      curLoc = moveToEndOfValue(buffer, curLoc + 1); // start after close quote

      //console.log("raw: " + buffer.substring(fieldStart-1,curLoc-1));

      if (curLoc < len && fieldName == "results")
        return (buffer.substring(valueStart, curLoc - 1));
    }
  }

  //
  // utility function to traverse strings, finding the end
  //

  function moveToEndOfString(buffer, curLoc) {
    while (curLoc < buffer.length) {     // loop until close quote
      var cur = buffer.charAt(curLoc);
      if (cur == '\\')
        curLoc += 2; // skip quoted characters
      else if (cur != '"')
        curLoc++;
      else
        break;
    }
    return curLoc;
  }

  // utility function to find the end of a value, which might be an number, string,
  // object, or array, whose value ends with a comma or a close brace (marking
  // the end of everything)

  function moveToEndOfValue(buffer, curLoc) {
    // now parse the value, which might be an number, string, object, or array,
    // whose value ends with a comma or a close brace (marking the end of everything)

    var braceCount = 0;
    var bracketCount = 0;

    while (curLoc < buffer.length) {
      //console.log(curLoc + ": " + buffer.charAt(curLoc) + ", braces: " + braceCount + ", brackets: " + bracketCount);
      switch (buffer.charAt(curLoc++)) {
        case '{':
          braceCount++;
          break;
        case '}': // if we're not inside an array or object, we're done
          if (braceCount == 0 && bracketCount == 0)
            return (curLoc);
          else
            braceCount--;
          break;
        case '[':
          bracketCount++;
          break;
        case ']':
          bracketCount--;
          break;
        case '"':
          curLoc = moveToEndOfString(buffer, curLoc) + 1;
          break;
        case ',':
          if (braceCount == 0 && bracketCount == 0)
            return (curLoc);
          break;
        default: // ignore other characters
      }
    }
    return (curLoc);
  }

  //
  // manage query monitoring for analytics
  //

  function updateQueryMonitoring(category) {

    var query1 = "select value active_requests()";
    var query2 = "select value completed_requests()";
    var query = '';

    switch (category) {
      case 1:
        query = query1;
        break;
      case 2:
        query = query2;
        break;
      default:
        return;
    }

    var result = [];

    //console.log("Got query: " + query);
    //var config = {headers: {'Content-Type':'application/json','ns-server-proxy-timeout':20000}};
    //console.log("Running monitoring cat: " + category + ", query: " + payload.statement);

    return (executeQueryUtil(query, false))
      .then(function success(response) {
          var data = response.data;
          var status = response.status;
          var headers = response.headers;
          var config = response.config;

          if (data.status == "success") {
            result = data.results[0];

            // we need to reformat the duration values coming back
            // since they are numbers, convert to time

            for (var i = 0; i < result.length; i++) if (result[i].elapsedTime) {
              result[i].elapsedTime = qwQueryPlanService.convertTimeFloatToFormattedString(result[i].elapsedTime);
            }
          } else {
            result = [data.errors];
          }

          switch (category) {
            case 1:
              cwQueryService.monitoring.active_requests = result;
              cwQueryService.monitoring.active_updated = new Date();
              break;
            case 2:
              cwQueryService.monitoring.completed_requests = result;
              cwQueryService.monitoring.completed_updated = new Date();
              break;
          }


        },
        function error(response) {
          var data = response.data;
          var status = response.status;
          var headers = response.headers;
          var config = response.config;

          //console.log("Mon Error Data: " + JSON.stringify(data));
          //console.log("Mon Error Status: " + JSON.stringify(status));
          //console.log("Mon Error Headers: " + JSON.stringify(headers));
          //console.log("Mon Error Config: " + JSON.stringify(config));
          var error = "Error with query monitoring";

          if (data && data.errors)
            error = error + ": " + JSON.stringify(data.errors);
          else if (status && _.isString(data))
            error = error + ", query service returned status: " + status + ", " + data;
          else if (status)
            error = error + ", query service returned status: " + status;

          logWorkbenchError(error);
          //        console.log("Got error: " + error);

          switch (category) {
            case 1:
              cwQueryService.monitoring.active_requests = [{statment: error}];
              cwQueryService.monitoring.active_updated = new Date();
              break;
            case 2:
              cwQueryService.monitoring.completed_requests = [{statement: error}];
              cwQueryService.monitoring.completed_updated = new Date();
              break;
          }

        });
  };

  //
  // get stats for the past minute
  //

  function getStats(stats) {
    var requests = [];
    var data = {
      startTS: Date.now() - 5000,
      endTS: Date.now(),
      step: 1,
      host: 'aggregate'
    };
    stats.forEach(function (statName) {
      requests.push(
        $http({
          type: "GET",
          url: "/_uistats/v2",
          params: Object.assign({statName: statName}, data)
        }));
    });

    return ($q.all(requests));
  }


  //
  // show an error dialog
  //

  function showErrorDialog(message) {
    qwDialogService.showErrorDialog("Error",message,null,true)
      .then(() => Promise.resolve("done"),() => Promise.resolve("done"));
  }

  function showWarningDialog(message) {
    qwDialogService.showErrorDialog("Warning",message,null,true)
      .then(() => Promise.resolve("done"),() => Promise.resolve("done"));
  }

  function showConfirmationDialog(title,message,details) {
    return(qwDialogService.showNoticeDialog("Warning",message,details));
  }

  //
  // functions for creating, changing, and removing remote links
  //

  function getCachedLinkInfo(dataverse, linkName) {
    if (_.isArray(cwQueryService.links))
      return cwQueryService.links.find(element => element.name == linkName && element.scope == dataverse);

    return (null);
  }

  function getLink(dataverse, linkName) {
    return $http({
      url: "/_p/cbas/analytics/link/" + encodeURIComponent(dataverse) + "/" + encodeURIComponent(linkName),
      method: "GET",
    });
  }

  function deleteLink(dataverse, linkName) {
    return $http({
      url: "/_p/cbas/analytics/link/" + encodeURIComponent(dataverse) + "/" + encodeURIComponent(linkName),
      method: "DELETE",
    });
  }

  function editLink(linkDialogScope) {
    return $http({
      url: "/_p/cbas/analytics/link/" + encodeURIComponent(linkDialogScope.dataverse) + "/" + encodeURIComponent(linkDialogScope.link_name),
      method: "PUT",
      data: convertDialogScopeToAPIdata(linkDialogScope),
    });
  }

  function createLink(linkDialogScope, dataverse) {
    var request = {
      url: "/_p/cbas/analytics/link" + (mnPoolDefault.export.compat.atLeast70 ?
        '/' + encodeURIComponent(dataverse.DataverseName) + "/" + encodeURIComponent(linkDialogScope.link_name) : ""),
      method: "POST",
      data: convertDialogScopeToAPIdata(linkDialogScope),
    };
    return $http(request);
  }

  function getAwsSupportedRegions() {
    $http({
      url: cwConstantsService.awsRegionsURL,
      headers: {'Content-Type': 'application/json', 'ignore-401': 'true', 'Analytics-Priority': '-1'},
      method: "GET"
    }).then(function success(resp) {
      cwQueryService.awsRegions = resp.data;
    }, function error(resp) {
      cwQueryService.awsRegions = [
        "af-south-1",
        "ap-east-1",
        "ap-northeast-1",
        "ap-northeast-2",
        "ap-northeast-3",
        "ap-south-1",
        "ap-southeast-1",
        "ap-southeast-2",
        "ca-central-1",
        "cn-north-1",
        "cn-northwest-1",
        "eu-central-1",
        "eu-north-1",
        "eu-south-1",
        "eu-west-1",
        "eu-west-2",
        "eu-west-3",
        "me-south-1",
        "sa-east-1",
        "us-east-1",
        "us-east-2",
        "us-west-1",
        "us-west-2",
      ];
    });;
  }

  function convertDialogScopeToAPIdata(scope) {
    var formData = {
      type: scope.link_type
    };

    // 6.6 and before this is in form data, after that it's in the URL
    if (!mnPoolDefault.export.compat.atLeast70) {
      formData.dataverse = scope.dataverse;
      formData.name = scope.link_name;
    }

    if (scope.link_type == "couchbase") {
      formData.hostname = scope.couchbase_link.hostname;
      if (scope.couchbase_link.username)
        formData.username = scope.couchbase_link.username;
      if (scope.couchbase_link.password)
        formData.password = scope.couchbase_link.password;
      if (!scope.couchbase_link.demand_encryption)
        formData.encryption = "none";
      else
        formData.encryption = scope.couchbase_link.encryption_type;
      if (formData.encryption != "none") {
        if (scope.couchbase_link.certificate)
          formData.certificate = scope.couchbase_link.certificate;
        if (scope.couchbase_link.client_certificate)
          formData.clientCertificate = scope.couchbase_link.client_certificate;
        if (scope.couchbase_link.client_key)
          formData.clientKey = scope.couchbase_link.client_key;
      }
    } else if (scope.link_type == "s3") {
      formData.accessKeyId = scope.s3_link.access_key_id;
      if (scope.s3_link.access_key)
        formData.secretAccessKey = scope.s3_link.access_key;
      formData.region = scope.s3_link.region;
      if (scope.s3_link.endpoint)
        formData.serviceEndpoint = scope.s3_link.endpoint;
    } else if (scope.link_type == "azureblob" || scope.link_type == "azuredatalake") {
        formData.endpoint = scope.azure_link.endpoint;

        if (scope.azure_link.auth_type == "sharedkey") {
            formData.accountName = scope.azure_link.account_name;
            formData.accountKey = scope.azure_link.account_key;
        }

        if (scope.azure_link.auth_type == "sharedaccesssignature") {
            formData.sharedAccessSignature = scope.azure_link.shared_access_signature;
        }

        if (scope.azure_link.auth_type == "managedidentityid") {
            formData.managedIdentityId = scope.azure_link.managed_identity_id;
        }

        if (scope.azure_link.auth_type == "clientsecret") {
            formData.clientId = scope.azure_link.client_id;
            formData.tenantId = scope.azure_link.tenant_id;
            formData.clientSecret = scope.azure_link.client_secret;
        }

        if (scope.azure_link.auth_type == "clientcertificate") {
            formData.clientId = scope.azure_link.client_id;
            formData.tenantId = scope.azure_link.tenant_id;
            formData.clientCertificate = scope.azure_link.client_certificate;

            if (scope.azure_link.is_client_certificate_password == true) {
                formData.clientCertificatePassword = scope.azure_link.client_certificate_password;
            }
        }
    } else if (scope.link_type == "gcs") {
        if (scope.gcs_link.auth_type == "jsoncredentials") {
          formData.jsonCredentials = scope.gcs_link.json_credentials;
        }
    }

    return formData;
  }

  function convertAPIdataToDialogScope(apiData, scope) {
    scope.link_name = apiData.name;
    scope.link_type = apiData.type;
    scope.dataverse = apiData.dataverse;
    if (apiData.type == "couchbase") {
      scope.couchbase_link.hostname = apiData.activeHostname;
      scope.couchbase_link.username = apiData.username;
      scope.couchbase_link.passward = apiData.password;
      scope.couchbase_link.encryption_type = apiData.encryption;
      if (apiData.encryption != "none") {
        scope.couchbase_link.demand_encryption = true;
        scope.couchbase_link.certificate = apiData.certificate;
        scope.couchbase_link.client_certificate = apiData.clientCertificate;
        scope.couchbase_link.client_key = apiData.clientKey;
      }

    } else if (apiData.type == "s3") {
      scope.s3_link.access_key_id = apiData.accessKeyId;
      scope.s3_link.access_key = apiData.secretAccessKey;
      scope.s3_link.region = apiData.region;
      scope.s3_link.endpoint = apiData.serviceEndpoint;
    } else if (apiData.type == "azureblob" || apiData.type == "azuredatalake") {
      // Based on the retrieved data, set the correct auth_type
      if (apiData.accountName) {
        scope.azure_link.auth_type = "sharedkey";
      } else if (apiData.sharedAccessSignature) {
        scope.azure_link.auth_type = "sharedaccesssignature";
      } else if (apiData.managedIdentityId) {
        scope.azure_link.auth_type = "managedidentityid";
      } else if (apiData.clientSecret) {
        scope.azure_link.auth_type = "clientsecret";
      } else if (apiData.clientCertificate) {
        scope.azure_link.auth_type = "clientcertificate";
        if (apiData.clientCertificatePassword) {
          scope.azure_link.is_client_certificate_password = true;
        }
      } else {
        scope.azure_link_auth_type = "anonymous";
      }

      scope.azure_link.endpoint = apiData.endpoint;
      scope.azure_link.account_name = apiData.accountName;
      scope.azure_link.account_key = "";
      scope.azure_link.shared_access_signature = "";
      scope.azure_link.managed_identity_id = apiData.managedIdentityId;
      scope.azure_link.client_id = apiData.clientId;
      scope.azure_link.tenant_id = apiData.tenantId;
      scope.azure_link.client_secret = "";
      scope.azure_link.client_certificate = "";
      scope.azure_link.client_certificate_password = "";
    } else if (apiData.type == "gcs") {
      if (apiData.jsonCredentials) {
        scope.gcs_link.auth_type = "jsoncredentials";
      } else {
        scope.gcs_link.auth_type = "anonymous";
      }

      scope.gcs_link.json_credentials = "";
    }
  }

  //
  // load state from storage if possible
  //

  loadStateFromStorage();

  //
  // all done creating the service, now return it
  //

  return cwQueryService;
}

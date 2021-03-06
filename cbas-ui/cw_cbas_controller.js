import _ from "/ui/web_modules/lodash.js";
import ace from '/ui/libs/ace/ace-wrapper.js';
import saveAs from "/ui/web_modules/file-saver.js";

export default cbasController;

  function cbasController($rootScope, $stateParams, $uibModal, $timeout, cwQueryService,
                          validateCbasService, mnPools, $scope, cwConstantsService, mnPoolDefault,
                          mnServersService, $interval, qwJsonCsvService, jQuery, qwCollectionsService) {
    var $ = jQuery;
    var qc = this;
    var statsRefreshInterval = 5000;
    var updateEditorSizes = _.throttle(updateEditorSizesInner, 100);

    //console.log("Start controller at: " + new Date().toTimeString());

    //
    // current UI version number
    //

    qc.version = "1.0.8 (DP 8)";

    //
    // alot of state is provided by the cwQueryService
    //

    qc.dataverses = cwQueryService.dataverses;          // dataverses
    qc.dataverse_links = cwQueryService.dataverse_links; // all links used in each dataverse
    qc.shadows = cwQueryService.shadows;                // shadow datasets on cluster
    qc.clusterBuckets = cwQueryService.clusterBuckets; // all cluster buckets
    qc.gettingBuckets = cwQueryService.gettingBuckets;  // busy retrieving?
    qc.updateBuckets = cwQueryService.updateBuckets;    // function to update
    qc.lastResult = cwQueryService.getResult(); // holds the current query and result
    //qc.limit = cwQueryService.limit;            // automatic result limiter
    qc.executingQuery = cwQueryService.executingQuery;
    qc.emptyQuery = function () {
      return (cwQueryService.getResult().query.length == 0);
    };
    qc.emptyResult = cwQueryService.emptyResult;
    qc.planFormat = cwQueryService.planFormat;
    qc.datasetDisconnectedState = cwQueryService.datasetDisconnectedState;
    qc.datasetUnknownState = cwQueryService.datasetUnknownState;
    qc.externalDatasetState = cwQueryService.externalDatasetState;
    qc.isAllowedMultiStatement = cwQueryService.isAllowedMultiStatement;

    qc.toggleFullscreen = toggleFullscreen;
    qc.queryContext = "";
    qc.scopeNames = cwQueryService.scopeNames;

    // functions for connecting dataverses to links and datasets
    qc.getLinksInDataverse = getLinksInDataverse;
    qc.getLocalLink = getLocalLink;
    qc.getDatasetsInLink = getDatasetsInLink;

    // some functions for handling query history, going backward and forward

    qc.prev = prevResult;
    qc.next = nextResult;

    qc.hasNext = cwQueryService.hasNextResult;
    qc.hasPrev = cwQueryService.hasPrevResult;

    qc.canCreateBlankQuery = cwQueryService.canCreateBlankQuery;

    qc.getCurrentIndex = cwQueryService.getCurrentIndex;
    qc.clearHistory = cwQueryService.clearHistory;

    qc.historyMenu = edit_history;

    // variable and code for managing the choice of output format in different tabs

    qc.selectTab = selectTab;
    qc.isSelected = cwQueryService.isSelected;

    qc.status_success = cwQueryService.status_success;
    qc.status_fail = cwQueryService.status_fail;
    qc.qqs = cwQueryService;

    //
    // options for the two editors, query and result
    //

    qc.aceInputLoaded = aceInputLoaded;
    qc.aceInputChanged = aceInputChanged;
    qc.aceOutputLoaded = aceOutputLoaded;
    qc.aceOutputChanged = aceOutputChanged;
    qc.updateEditorSizes = updateEditorSizes;

    qc.acePlanLoaded = acePlanLoaded;
    qc.acePlanChanged = acePlanChanged;
    qc.userIntertest = 'editor';

    //
    // expand/collapse the analysis pane
    //

    qc.analysisExpanded = false;
    qc.toggleAnalysisSize = toggleAnalysisSize;

    //
    // functions for running queries and saving results
    //

    qc.query = query;
    qc.save = save;
    qc.save_query = save_query;
    qc.unified_save = unified_save;
    qc.options = options;

    qc.load_query = load_query;

    qc.connectLink = connectLink;
    qc.disconnectLink = disconnectLink;

    qc.createNewLink = createNewLink;
    qc.editLink = editLink;

    qc.mapCollections = mapCollections;
    qc.createNewDataset = createNewDataset;
    qc.editDataset = editDataset;

    //
    // options for the two Ace editors, the input and the output
    //

    qc.aceInputOptions = {
      mode: cwConstantsService.queryMode,
      showGutter: true,
      onLoad: qc.aceInputLoaded,
      onChange: qc.aceInputChanged,
      $blockScrolling: Infinity
    };

    qc.aceOutputOptions = {
      mode: 'json',
      showGutter: true,
      useWrapMode: true,
      onLoad: qc.aceOutputLoaded,
      onChange: qc.aceOutputChanged,
      $blockScrolling: Infinity
    };

    qc.acePlanOptions = {
      mode: 'json',
      showGutter: true,
      useWrapMode: true,
      onLoad: qc.acePlanLoaded,
      onChange: qc.acePlanChanged,
      $blockScrolling: Infinity
    };

    //
    // Do we have a REST API to work with?
    //

    qc.validated = validateCbasService;
    qc.validNodes = [];

    //
    // error message when result is too large to display
    //

    qc.maxTableSize = 750000;
    qc.maxTreeSize = 750000;
    qc.maxAceSize = 10485760;
    qc.maxSizeMsgTable = {error: "The table view is slow with results sized > " + qc.maxTableSize + " bytes. Try using the JSON view or specifying a lower limit in your query."};
    qc.maxSizeMsgTree = {error: "The tree view is slow with results sized > " + qc.maxTreeSize + " bytes. Try using the JSON view or specifying a lower limit in your query."};
    qc.maxSizeMsgJSON = "{\"error\": \"The JSON view is slow with results sized > " + qc.maxAceSize + " bytes. Try specifying a lower limit in your query.\"}";

    qc.showBigDatasets = false;     // allow the user to override the limit on showing big datasets

    qc.dataTooBig = dataTooBig;
    qc.setShowBigData = setShowBigData;
    qc.getBigDataMessage = getBigDataMessage;

    // should we have the extra explain tabs?

    qc.autoExplain = cwConstantsService.autoExplain;

    qc.showBucketAnalysis = cwConstantsService.showBucketAnalysis;

    qc.showOptions = cwConstantsService.showOptions;

    qc.format = format;

    //
    // does the browser support file choosing?
    //

    qc.fileSupport = (window.File && window.FileReader && window.FileList && window.Blob);

    //
    // labels for bucket analysis pane
    qc.analysisFirstSection = cwConstantsService.analysisFirstSection;
    qc.analysisSecondSection = cwConstantsService.analysisSecondSection;
    qc.analysisThirdSection = cwConstantsService.analysisThirdSection;
    qc.bucketInsightsUpdateTriggers = cwConstantsService.bucketInsightsUpdateTriggers;
    // are we enterprise?

    qc.isEnterprise = mnPools.export.isEnterprise;

    qc.copyResultAsCSV = function () {
      copyResultAsCSV();
    };

    qc.showEmptyScopes = function() {return cwQueryService.showEmptyScopes;};
    qc.toggleEmptyScopes = function() {cwQueryService.showEmptyScopes = !cwQueryService.showEmptyScopes;};
    qc.scopeEmpty = function(dataverse)
    {return !cwQueryService.shadows.some(shadow => shadow.bucketDataverseName == dataverse.DataverseName)};

    // helper functions //
    qc.forceReload = forceReload;
    qc.lastResultWarnings = lastResultWarnings;
    //
    // call the activate method for initialization
    //

    activate();

    //
    // Is the data too big to display for the selected results pane?
    //

    function dataTooBig() {
      switch (cwQueryService.outputTab) {
        case 1:
          return (qc.lastResult.resultSize / qc.maxAceSize) > 1.1;
        case 2:
          return (qc.lastResult.resultSize / qc.maxTableSize) > 1.1;
        case 3:
          return (qc.lastResult.resultSize / qc.maxTreeSize) > 1.1;
      }

    }

    //
    // get a string to describe why the dataset is large
    //

    function getBigDataMessage() {
      var fraction;
      switch (cwQueryService.outputTab) {
        case 1:
          fraction = qc.lastResult.resultSize / qc.maxAceSize;
          break;
        case 2:
          fraction = qc.lastResult.resultSize / qc.maxTableSize;
          break;
        case 3:
          fraction = qc.lastResult.resultSize / qc.maxTreeSize;
          break;
      }
      var timeEstimate = Math.round(fraction * 2.5);
      var timeUnits = "seconds";
      if (timeEstimate > 60) {
        timeEstimate = Math.round(timeEstimate / 60);
        timeUnits = "minutes";
      }
      var message = "The current dataset, " + qc.lastResult.resultSize + " " +
        "bytes, is too large to display quickly.<br>Using a lower limit or a more " +
        "specific where clause in your query can reduce result size. Rendering " +
        "might freeze your browser for " + timeEstimate + " to " + timeEstimate * 4 +
        " " + timeUnits + " or more. ";

      if (cwQueryService.outputTab != 1) {
        message += "The JSON view is about 10x faster. ";
      }

      return (message);
    }

    function setShowBigData(show) {
      qc.showBigDatasets = show;
      $timeout(swapEditorFocus, 10);
    }

    //
    // change the tab selection
    //

    function selectTab(tabNum) {
      if (qc.isSelected(tabNum))
        return; // avoid noop

      qc.showBigDatasets = false;
      cwQueryService.selectTab(tabNum);
      // select focus after a delay to try and force update of the editor
      $timeout(swapEditorFocus, 10);
    };

    //
    // we need to define a wrapper around qw_query_server.nextResult, because if the
    // user creates a new blank query, we need to refocus on it.
    //

    function nextResult() {
      qc.showBigDatasets = false;
      cwQueryService.nextResult();
      $timeout(swapEditorFocus, 10);
    }

    function prevResult() {
      qc.showBigDatasets = false;
      cwQueryService.prevResult();
      $timeout(swapEditorFocus, 10);
    }

    //
    // the text editor doesn't update visually if changed when off screen. Force
    // update by focusing on it
    //

    function swapEditorFocus() {
      if (qc.outputEditor) {
        qc.outputEditor.focus();
        qc.inputEditor.focus();
      }
      updateEditorSizes();
    }

    //
    // manage the ACE code editors for query input and JSON output
    //

    var endsWithSemi = /;\s*$/i;

    function aceInputChanged(e) {
      //console.log("input changed, action: " + JSON.stringify(e[0]));
      //console.log("current session : " + JSON.stringify(qc.inputEditor.getSession()));
      // show a placeholder when nothing has been typed
      var curSession = qc.inputEditor.getSession();
      var noText = curSession.getValue().length == 0;
      var emptyMessageNode = qc.inputEditor.renderer.emptyMessageNode;

      // when the input is changed, clear all the markers
      curSession.clearAnnotations();
      if (qc.markerIds) {
        for (var i = 0; i < qc.markerIds.length; i++)
          curSession.removeMarker(qc.markerIds[i]);
        qc.markerIds.length = 0;
      }

      //console.log("Notext: " +noText + ", emptyMessageNode: " + emptyMessageNode);
      if (noText && !emptyMessageNode) {
        emptyMessageNode = qc.inputEditor.renderer.emptyMessageNode = document.createElement("div");
        emptyMessageNode.innerText = "Enter a query here.";
        emptyMessageNode.className = "ace_invisible ace_emptyMessage";
        emptyMessageNode.style.padding = "0 5px";
        qc.inputEditor.renderer.scroller.appendChild(emptyMessageNode);
      } else if (!noText && emptyMessageNode) {
        qc.inputEditor.renderer.scroller.removeChild(emptyMessageNode);
        qc.inputEditor.renderer.emptyMessageNode = null;
      }

      qc.inputEditor.$blockScrolling = Infinity;

      // for inserts, by default move the cursor to the end of the insert

      if (e[0].action === 'insert') {
        updateEditorSizes();
        qc.inputEditor.moveCursorToPosition(e[0].end);
        qc.inputEditor.focus();

        // if they pasted more than one line, and we're at the end of the editor, trim
        var pos = qc.inputEditor.getCursorPosition();
        var line = qc.inputEditor.getSession().getLine(pos.row);
        if (e[0].lines && e[0].lines.length > 1 && e[0].lines[0].length > 0 &&
          pos.row == (qc.inputEditor.getSession().getLength() - 1) &&
          pos.column == line.length)
          qc.lastResult.query = qc.lastResult.query.trim();

        // if they hit enter and the query ends with a semicolon, run the query
        if (cwConstantsService.autoExecuteQueryOnEnter && // auto execute enabled
          pos.row == (qc.inputEditor.getSession().getLength() - 1) && // cursor at last line
          containsValidStatements(curSession.getValue()) && // valid single/multi-statements
          e[0].lines && e[0].lines.length == 2 && // <cr> marked by two empty lines
          e[0].lines[0].length == 0 &&
          e[0].lines[1].length == 0 &&
          e[0].start.column > 0 && // and the previous line wasn't blank
          curSession.getLine(e[0].start.row).trim()[curSession.getLine(e[0].start.row).trim().length - 1] === ';' &&
          endsWithSemi.test(qc.lastResult.query))
          qc.query();
      }

    };

    //
    // initialize the query editor
    //

    var langTools = ace.require("ace/ext/language_tools");
    var autocomplete = ace.require("ace/autocomplete");
    var mode_sql_plus_plus;

    function aceInputLoaded(_editor) {
      mode_sql_plus_plus = ace.require("ace/mode/sql-plus-plus");
      _editor.$blockScrolling = Infinity;
      _editor.setFontSize('13px');
      _editor.renderer.setPrintMarginColumn(false);
      _editor.setReadOnly(qc.executingQuery.busy);

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      qc.inputEditor = _editor;

      //
      // only support auto-complete if we're in enterprise mode
      //

      if (mnPools.export.isEnterprise) {
        // make autocomplete work with 'tab', and auto-insert if 1 match
        autocomplete.Autocomplete.startCommand.bindKey = "Ctrl-Space|Ctrl-Shift-Space|Alt-Space|Tab";
        autocomplete.Autocomplete.startCommand.exec = autocomplete_exec;
        // enable autocomplete
        _editor.setOptions({enableBasicAutocompletion: true});
        // add completer that works with path expressions with '.'
        langTools.setCompleters([identifierCompleter, langTools.keyWordCompleter]);
      }

      focusOnInput();

      //
      // make the query editor "catch" drag and drop files
      //

      $(".wb-query-editor")[0].addEventListener('dragover', handleDragOver, false);
      $(".wb-query-editor")[0].addEventListener('drop', handleFileDrop, false);
    };

    //
    // format the contents of the query field
    //

    function format() {
      qc.lastResult.query = mode_sql_plus_plus.Instance.format(qc.lastResult.query, 2);
    }

    // this function is used for autocompletion of dynamically known names such
    // as bucket names, field names, and so on. We only want to return items that
    // either start with the prefix, or items where the prefix follows a '.'
    // (meaning that the prefix is a field name from a path

    var identifierCompleter = {
      getCompletions: function (editor, session, pos, prefix, callback) {
        //console.log("Completing: *" + prefix + "*");

        var results = [];
        var modPrefix = '.' + prefix;
        var modPrefix2 = '`' + prefix;
        for (var i = 0; i < cwQueryService.autoCompleteArray.length; i++) {
          //console.log("  *" + cwQueryService.autoCompleteArray[i].caption + "*");
          if (_.startsWith(cwQueryService.autoCompleteArray[i].caption, prefix) ||
            cwQueryService.autoCompleteArray[i].caption.indexOf(modPrefix) >= 0 ||
            cwQueryService.autoCompleteArray[i].caption.indexOf(modPrefix2) >= 0) {
            //console.log("    Got it, pushing: " + cwQueryService.autoCompleteArray[i]);
            results.push(cwQueryService.autoCompleteArray[i]);
          }
        }

        callback(null, results);
      },

      /*
       * We need to override the 'retrievePrecedingIdentifier' regex which treats path
       * expressions separated by periods as separate identifiers, when for the purpose
       * of autocompletion, we want to treat paths as a single identifier. We also need
       * to recognize backtick as part of an identifier.
       */

      identifierRegexps: [/[a-z\.`:A-Z_0-9\$\-\u00A2-\uFFFF]/]
    };

    //
    // for autocompletion, we want to override the 'exec' function so that autoInsert
    // is the default (i.e., if there is only one match, don't bother showing the menu).
    //

    var autocomplete_exec = function (editor) {
      if (!editor.completer)
        editor.completer = new autocomplete.Autocomplete();
      editor.completer.autoInsert = true;
      editor.completer.autoSelect = true;
      editor.completer.showPopup(editor);
      editor.completer.cancelContextMenu();
    };

    //
    // We want to be able to handle a file drop on the query editor. Default behavior
    // is to change the browser to a view of that file, so we need to override that
    //

    function handleDragOver(evt) {
      evt.stopPropagation();
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'copy';
    }

    //
    // When they drop the file, take the contents and put in the
    //
    function handleFileSelect() {
      loadQueryFileList(this.files);
    }


    function handleFileDrop(evt) {
      evt.stopPropagation();
      evt.preventDefault();

      var files = evt.dataTransfer.files; // FileList object.
      loadQueryFileList(files);
    }

    function loadQueryFileList(files) {
      // make sure we have a file
      if (files.length == 0)
        return;

      // make sure the file ends in .txt or .n1ql
      var file = files.item(0);
      if (!file.name.toLowerCase().endsWith(".n1ql") && !file.name.toLowerCase().endsWith(".txt")) {
        showErrorMessage("Can't load: " + file.name + ".\nQuery import only supports files ending in '.txt'")
        return;
      }

      // files is a FileList of File objects. load the first one into the editor, if any.
      var reader = new FileReader();
      reader.addEventListener("loadend", function () {
        addNewQueryContents(reader.result);
      });
      reader.readAsText(files[0]);
    }

    // when they click the Load Query button

    function load_query() {
      $("#loadQuery")[0].value = null;
      $("#loadQuery")[0].addEventListener('change', handleFileSelect, false);
      $("#loadQuery")[0].click();
    }

    // bring the contents of a file into the query editor and history

    function addNewQueryContents(contents) {
      // move to the end of history
      cwQueryService.addNewQueryAtEndOfHistory(contents);
      qc.inputEditor.getSession().setValue(contents);
    }

    //
    // Initialize the output ACE editor
    //

    function aceOutputLoaded(_editor) {
      //console.log("AceOutputLoaded");
      _editor.$blockScrolling = Infinity;
      _editor.setReadOnly(true);
      _editor.renderer.setPrintMarginColumn(false); // hide page boundary lines

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      qc.outputEditor = _editor;
      updateEditorSizes();
    };

    function aceOutputChanged(e) {
      updateEditorSizes();

      // show a placeholder when nothing has been typed
      var curSession = qc.outputEditor.getSession();
      var noText = curSession.getValue().length == 0;
      var emptyMessageNode = qc.outputEditor.renderer.emptyMessageNode;

      //console.log("Notext: " +noText + ", emptyMessageNode: " + emptyMessageNode);
      if (noText && !emptyMessageNode) {
        emptyMessageNode = qc.outputEditor.renderer.emptyMessageNode = document.createElement("div");
        emptyMessageNode.className = "ace_invisible ace_emptyMessage";
        emptyMessageNode.style.padding = "0 5px";
        qc.outputEditor.renderer.scroller.appendChild(emptyMessageNode);
      } else if (!noText && emptyMessageNode) {
        qc.outputEditor.renderer.scroller.removeChild(emptyMessageNode);
        qc.outputEditor.renderer.emptyMessageNode = null;
      }

    }

    function acePlanLoaded(_editor) {
      //console.log("AcePlanLoaded");
      qc.planEditor = _editor;
      _editor.$blockScrolling = Infinity;
      _editor.setReadOnly(true);
      _editor.renderer.setPrintMarginColumn(false); // hide page boundary lines

      if (/^((?!chrome).)*safari/i.test(navigator.userAgent))
        _editor.renderer.scrollBarV.width = 20; // fix for missing scrollbars in Safari

      //qc.outputEditor = _editor;
      updateEditorSizes();
    }

    function acePlanChanged(e) {
      if (cwQueryService.planFormat === "json") {
        qc.planEditor.session.setMode("ace/mode/json");
      } else {
        qc.planEditor.session.setMode("ace/mode/text");
      }
      //e.$blockScrolling = Infinity;

      updateEditorSizes();
    }

    //
    // called when the JSON output changes. We need to make sure the editor is the correct size,
    // since it doesn't auto-resize
    //

    function updateEditorSizesInner() {
      var totalHeight = window.innerHeight - 130; // window minus header size
      var aceEditorHeight = 0;

      // how much does the query editor need?
      if (qc.inputEditor) {
        // give the query editor at least 3 lines, but it might want more if the query has > 3 lines
        var lines = qc.inputEditor.getSession().getLength();       // how long in the query?
        var desiredQueryHeight = Math.max(23, (lines - 1) * 22 - 21);         // make sure height no less than 23

        // when focused on the query editor, give it up to 3/4 of the total height, but make sure the results
        // never gets smaller than 270
        var maxEditorSize = Math.min(totalHeight * 3 / 4, totalHeight - 270);

        // if the user has been clicking on the results, minimize the query editor
        if (qc.userInterest == 'results')
          aceEditorHeight = 23;//Math.min(totalHeight/5,desiredQueryHeight); // 1/5 space for editor, more for results
        else
          aceEditorHeight = Math.min(maxEditorSize, desiredQueryHeight);      // don't give it more than it wants

        $(".wb-ace-editor").height(aceEditorHeight);
        $timeout(resizeInputEditor, 200); // wait until after transition
      }
    }

    //
    // convenience functions for safely refreshing the ACE editors
    //

    function resizeInputEditor() {
      try {
        if (qc.inputEditor && qc.inputEditor.renderer && qc.inputEditor.resize)
          qc.inputEditor.resize();
      } catch (e) {
        console.log("Input error: " + e);/*ignore*/
      }
    }

    function resizeOutputEditor() {
      try {
        if (qc.outputEditor && qc.outputEditor.renderer && qc.outputEditor.resize)
          qc.outputEditor.resize();
      } catch (e) {
        console.log("Output error: " + e);/*ignore*/
      }
    }

    $(window).resize(updateEditorSizes);

    //
    // keep track of which parts of the UI the user is clicking, indicating their interest
    //

    qc.handleClick = function (detail) {
      qc.userInterest = detail;
      updateEditorSizes();
    }

    //
    // make the focus go to the input field, so that backspace doesn't trigger
    // the browser back button
    //

    function focusOnInput() {
      if (qc.inputEditor && qc.inputEditor.focus)
        qc.inputEditor.focus();
    }

    //
    // functions for running queries and saving results to a file
    //

    function query(explainOnly) {
      // make sure there is a query to run
      if (qc.lastResult.query.trim().length == 0)
        return;

      // if a query is already running, we should cancel it
      if (qc.executingQuery.busy) {
        cwQueryService.cancelQuery();
        return;
      }

      // don't let the user edit the query while it's running
      qc.inputEditor.setReadOnly(true);

      // remove trailing whitespace to keep query from growing, and avoid
      // syntax errors (query parser doesn't like \n after ;
      if (endsWithSemi.test(qc.lastResult.query))
        qc.lastResult.query = qc.lastResult.query.trim();

      var queryStr = qc.lastResult.query;

      //console.log("Running query: " + queryStr);
      // run the query and show a spinner

      var promise = cwQueryService.executeQuery(queryStr, qc.lastResult.query, cwQueryService.options, explainOnly, qc.queryContext);

      if (promise) {
        // also have the input grab focus at the end
        promise.then(doneWithQuery, doneWithQuery);
      } else
        doneWithQuery();
    };

    //
    // when a query finishes, we need to re-enable the query field, and try and put
    // the focus there
    //
    var aceRange = ace.require('ace/range').Range;

    function doneWithQuery() {
      // if there are possibly bad fields in the query, mark them
      var annotations = [];
      var markers = [];
      var markerIds = [];
      var session = qc.inputEditor.getSession();

      //console.log("Explain result: " + JSON.stringify(qc.lastResult.explainResult));
      //console.log("Explain result probs: " + JSON.stringify(qc.lastResult.explainResult.problem_fields));

      if (qc.lastResult && qc.lastResult.explainResult && qc.lastResult.explainResult.problem_fields &&
        qc.lastResult.explainResult.problem_fields.length > 0) {
        var lines = session.getLines(0, session.getLength() - 1);
        var fields = qc.lastResult.explainResult.problem_fields;

        var allFields = "";
        var field_names = [];

        for (var i = 0; i < fields.length; i++) {
          allFields += " " + fields[i].bucket + "." + fields[i].field.replace(/\[0\]/gi, "[]") + "\n";
          // find the final name in the field path, extracting any array expr
          var field = fields[i].field.replace(/\[0\]/gi, "");
          var lastDot = field.lastIndexOf(".");
          if (lastDot > -1)
            field = field.substring(lastDot);
          field_names.push(field);
        }

        // one generic warning for all unknown fields
        annotations.push(
          {
            row: 0, column: 0,
            text: "This query contains the following fields not found in the inferred schema for their bucket: \n" + allFields,
            type: "warning"
          });

        // for each line, for each problem field, find all matches and add an info annotation
        for (var l = 0; l < lines.length; l++)
          for (var f = 0; f < field_names.length; f++) {
            var startFrom = 0;
            var curIdx = -1;
            while ((curIdx = lines[l].indexOf(field_names[f], startFrom)) > -1) {
              markers.push({
                start_row: l,
                end_row: l,
                start_col: curIdx,
                end_col: curIdx + field_names[f].length
              });
              startFrom = curIdx + 1;
            }
          }
      }

      for (var i = 0; i < markers.length; i++)
        markerIds.push(session.addMarker(new aceRange(markers[i].start_row, markers[i].start_col,
          markers[i].end_row, markers[i].end_col),
          "ace_selection", "text"));

      if (annotations.length > 0)
        session.setAnnotations(annotations);
      else
        session.clearAnnotations();

      // now update everything
      qc.inputEditor.setReadOnly(false);
      qc.userInterest = 'results';
      qc.markerIds = markerIds;
      updateEditorSizes();
      focusOnInput();

      // check if updating bucket insights is needed
      if (qc.lastResult.status == "success") {
        var queryStr = qc.lastResult.query.toUpperCase();
        for (var i = 0; i < qc.bucketInsightsUpdateTriggers.length; i++) {
          if (queryStr.includes(qc.bucketInsightsUpdateTriggers[i])) {
            qc.updateBuckets();
            break;
          }
        }
      }
    }

    //
    // save the results to a file. Here we need to use a scope to to send the file name
    // to the file name dialog and get it back again.
    //

    var dialogScope = $rootScope.$new(true);

    // default names for save and save_query
    dialogScope.data_file = {name: "data.json"};
    dialogScope.query_file = {name: "n1ql_query.txt"};
    dialogScope.file = {name: "output"};

    function options() {
      var subdirectory = '/ui-current';
      dialogScope.options = cwQueryService.clone_options();
      dialogScope.mode = "analytics";
      dialogScope.options.positional_parameters = [];
      dialogScope.options.named_parameters = [];

      // the named & positional parameters are values, convert to JSON
      if (cwQueryService.options.positional_parameters)
        for (var i = 0; i < cwQueryService.options.positional_parameters.length; i++)
          dialogScope.options.positional_parameters[i] =
            JSON.stringify(cwQueryService.options.positional_parameters[i]);

      if (cwQueryService.options.named_parameters)
        for (var i = 0; i < cwQueryService.options.named_parameters.length; i++) {
          dialogScope.options.named_parameters.push({
            name: cwQueryService.options.named_parameters[i].name,
            value: JSON.stringify(cwQueryService.options.named_parameters[i].value)
          });
        }


      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory +
          '/prefs_dialog/qw_prefs_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        // any named or positional parameters are entered as JSON, and must be parsed into
        // actual values
        if (dialogScope.options.positional_parameters)
          for (var i = 0; i < dialogScope.options.positional_parameters.length; i++)
            dialogScope.options.positional_parameters[i] =
              JSON.parse(dialogScope.options.positional_parameters[i]);

        if (dialogScope.options.named_parameters)
          for (var i = 0; i < dialogScope.options.named_parameters.length; i++)
            dialogScope.options.named_parameters[i].value =
              JSON.parse(dialogScope.options.named_parameters[i].value);

        cwQueryService.options = dialogScope.options;
      });

    }

    function save() {
      // can't save empty query
      if (qc.emptyResult())
        return;

      var isSafari = /^((?!chrome).)*safari/i.test(navigator.userAgent);

      // safari does'nt support saveAs
      if (isSafari) {
        var file = new Blob([qc.lastResult.result], {type: "text/json", name: "data.json"});
        saveAs(file, dialogScope.data_file.name);
        return;
      }

      // but for those that do, get a name for the file
      dialogScope.file_type = 'json';
      dialogScope.file = dialogScope.data_file;
      var subdirectory = '/ui-current';

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory +
          '/file_dialog/qw_query_file_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        //console.log("Promise, file: " + tempScope.file.name + ", res: " + res);
        var file = new Blob([qc.lastResult.result], {type: "text/json"});
        saveAs(file, dialogScope.file.name);
      });
    };


    //
    // save the current query to a file. Here we need to use a scope to to send the file name
    // to the file name dialog and get it back again.
    //

    function save_query() {
      // can't save an empty query
      if (qc.emptyQuery())
        return;

      var isSafari = /^((?!chrome).)*safari/i.test(navigator.userAgent);

      // safari does'nt support saveAs
      if (isSafari) {
        var file = new Blob([qc.lastResult.query], {type: "text/json", name: "data.json"});
        saveAs(file, dialogScope.query_file.name);
        return;
      }

      // but for those that do, get a name for the file
      dialogScope.file_type = 'query';
      dialogScope.file = dialogScope.query_file;
      var subdirectory = '/ui-current';

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory +
          '/file_dialog/qw_query_file_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        //console.log("Promise, file: " + tempScope.file.name + ", res: " + res);
        var file = new Blob([qc.lastResult.query], {type: "text/plain"});
        saveAs(file, dialogScope.file.name);
      });
    };

    //
    // going forward we will have a single file dialog that allows the user to select
    // "Results" or "Query"
    //

    function unified_save() {
      dialogScope.safari = /^((?!chrome).)*safari/i.test(navigator.userAgent);

      // but for those that do, get a name for the file
      dialogScope.file_type = 'query';
      dialogScope.file = dialogScope.file;
      dialogScope.file_options = [{kind: "json", label: "Query Results"}];
      if (qc.lastResult.query && qc.lastResult.query.length > 0)
        dialogScope.file_options.push({kind: "txt", label: "Query Statement"});
      dialogScope.selected = {item: 0};

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query/ui-current/file_dialog/qw_query_unified_file_dialog.html',
        scope: dialogScope
      }).result;

      // now save it
      promise.then(function success(res) {
        var file;
        var file_extension;

        if (dialogScope.selected.item == 0) {
          file = new Blob([qc.lastResult.result], {type: "text/json", name: "data.json"});
          file_extension = ".json";
        } else if (dialogScope.selected.item == 1) {
          file = new Blob([qc.lastResult.query], {type: "text/plain", name: "query.txt"});
          file_extension = ".txt";
        } else
          console.log("Error, no match");


        // safari does'nt support saveAs
        //if (dialogScope.safari) {
        //  saveAs(file,dialogScope.query_file.name + file_extension);
        //  return;
        //}
        //else
        saveAs(file, dialogScope.file.name + file_extension);
      });

    }

    //
    // save the current query to a file. Here we need to use a scope to to send the file name
    // to the file name dialog and get it back again.
    //

    function edit_history() {

      // history dialog needs a pointer to the query service
      dialogScope.pastQueries = cwQueryService.getPastQueries();
      dialogScope.select = function (index) {
        cwQueryService.setCurrentIndex(index);
      };
      dialogScope.isRowSelected = function (row) {
        return (row == cwQueryService.getCurrentIndexNumber());
      };
      dialogScope.isRowMatched = function (row) {
        return (_.indexOf(historySearchResults, row) > -1);
      };
      dialogScope.showRow = function (row) {
        return (historySearchResults.length == 0 || dialogScope.isRowMatched(row));
      };
      dialogScope.del = function () {
        cwQueryService.clearCurrentQuery();
        updateSearchResults();
      };
      // disable delete button if search results don't include selected query
      dialogScope.disableDel = function () {
        return searchInfo.searchText.length > 0 && !dialogScope.isRowMatched(cwQueryService.getCurrentIndexNumber());
      };
      dialogScope.delAll = function (close) {
        var innerScope = $rootScope.$new(true);
        innerScope.error_title = "Delete All History";
        innerScope.error_detail = "Warning, this will delete the entire query history.";
        innerScope.showCancel = true;

        var promise = $uibModal.open({
          templateUrl: '../_p/ui/query/ui-current/password_dialog/qw_query_error_dialog.html',
          scope: innerScope
        }).result;

        promise.then(
          function success() {
            cwQueryService.clearHistory();
            close('ok');
          });

      };
      dialogScope.searchInfo = searchInfo;
      dialogScope.updateSearchResults = updateSearchResults;
      dialogScope.selectNextMatch = selectNextMatch;
      dialogScope.selectPrevMatch = selectPrevMatch;

      var subdirectory = '/ui-current';

      var promise = $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory +
          '/history_dialog/qw_history_dialog.html',
        scope: dialogScope
      }).result;

      promise.then(function (result) {
        if (result === 'run') {
          query(false);
        }
      });

      // scroll the dialog's table
      $timeout(scrollHistoryToSelected, 100);

    }

    var historySearchResults = [];
    var searchInfo = {searchText: "", searchLabel: "search:"};

    function scrollHistoryToSelected() {
      var label = "qw_history_table_" + cwQueryService.getCurrentIndexNumber();
      var elem = document.getElementById(label);
      if (elem)
        elem.scrollIntoView();
      window.scrollTo(0, 0);
    }

    function updateSearchLabel() {
      if (searchInfo.searchText.trim().length == 0)
        searchInfo.searchLabel = "search:";
      else
        searchInfo.searchLabel = historySearchResults.length + " matches";
    }

    function updateSearchResults() {
      var history = cwQueryService.getPastQueries();
      // reset the history
      var searchText = searchInfo.searchText.toLowerCase();
      historySearchResults.length = 0;
      if (searchInfo.searchText.trim().length > 0)
        for (var i = 0; i < history.length; i++) {
          //console.log("  comparing to: " + history[i].query)
          if (history[i].query.toLowerCase().indexOf(searchText) > -1)
            historySearchResults.push(i);
        }

      updateSearchLabel();

      if (historySearchResults.length == 0)
        scrollHistoryToSelected();
    }

    // get the next/previous query matching the search results

    function selectNextMatch() {
      var curMatch = cwQueryService.getCurrentIndexNumber();

      // nothing to do if no search results
      if (historySearchResults.length == 0)
        return;

      // need to find the value in the history array larger than the current selection, or wrap around
      for (var i = 0; i < historySearchResults.length; i++)
        if (historySearchResults[i] > curMatch) {
          cwQueryService.setCurrentIndex(historySearchResults[i]);
          scrollHistoryToSelected();
          return;
        }

      // if we get this far, wrap around to the beginning
      cwQueryService.setCurrentIndex(historySearchResults[0]);
      scrollHistoryToSelected();
    }

    function selectPrevMatch() {
      var curMatch = cwQueryService.getCurrentIndexNumber();

      // nothing to do if no search results
      if (historySearchResults.length == 0)
        return;

      // need to find the last value in the history array smaller than the current selection, or wrap around
      for (var i = historySearchResults.length - 1; i >= 0; i--)
        if (historySearchResults[i] < curMatch) {
          cwQueryService.setCurrentIndex(historySearchResults[i]);
          scrollHistoryToSelected();
          return;
        }

      // if we get this far, wrap around to the beginning
      cwQueryService.setCurrentIndex(historySearchResults[historySearchResults.length - 1]);
      scrollHistoryToSelected();
    }

    //
    // toggle the size of the analysis pane
    //

    function toggleAnalysisSize() {
      if (!qc.analysisExpanded) {
        $(".insights-sidebar").removeClass("width-3");
        $(".insights-sidebar").addClass("width-6");
        $(".wb-main-wrapper").removeClass("width-9");
        $(".wb-main-wrapper").addClass("width-6")
      } else {
        $(".insights-sidebar").removeClass("width-6");
        $(".insights-sidebar").addClass("width-3");
        $(".wb-main-wrapper").removeClass("width-6");
        $(".wb-main-wrapper").addClass("width-9");
      }
      qc.analysisExpanded = !qc.analysisExpanded;
    }


    //
    // show an error dialog
    //

    function showErrorMessage(message) {
      var subdirectory = '/ui-current';
      dialogScope.error_title = "Error";
      dialogScope.error_detail = message;

      $uibModal.open({
        templateUrl: '../_p/ui/query' + subdirectory + '/password_dialog/qw_query_error_dialog.html',
        scope: dialogScope
      });
    }

    //
    // when the cluster nodes change, test to see if it's a significant change. if so,
    // update the list of nodes.
    //

    var prev_active_nodes = null;

    function nodeListsEqual(one, other) {
      if (!_.isArray(one) || !_.isArray(other))
        return (false);

      if (one.length != other.length)
        return (false);

      for (var i = 0; i < one.length; i++) {
        if (!(_.isEqual(one[i].clusterMembership, other[i].clusterMembership) &&
          _.isEqual(one[i].hostname, other[i].hostname) &&
          _.isEqual(one[i].services, other[i].services) &&
          _.isEqual(one[i].status, other[i].status)))
          return false;
      }
      return (true);
    }


    //
    // get the latest valid nodes for query
    //

    function updateValidNodes() {
      qc.validNodes = mnPoolDefault.getUrlsRunningService(mnPoolDefault.latestValue().value.nodes, "cbas", null);
    }


    function copyResultAsCSV() {
      var csv = qwJsonCsvService.convertDocArrayToTSV(qc.lastResult.data);

      // error check
      if (!csv || csv.length == 0) {
        showErrorMessage("Unable to create tab-separated values, perhaps source data is not an array.");
        return;
      }

      // create temp element
      var copyElement = document.createElement("textarea");
      angular.element(document.body.append(copyElement));
      copyElement.value = csv;
      copyElement.focus();
      copyElement.select();
      document.execCommand('copy');
      copyElement.remove();
    }

    //
    // let's start off with a list of the buckets
    //

    function activate() {

      // if we receive a query parameter, and it's not the same as the current query,
      // insert it at the end of history
      if (_.isString($stateParams.query) && $stateParams.query.length > 0 &&
        $stateParams.query != qc.lastResult.query) {
        cwQueryService.addNewQueryAtEndOfHistory($stateParams.query);
      }

      //
      // make sure we stay on top of the latest query nodes
      //

      updateValidNodes();

      $rootScope.$on("nodesChanged", function () {
        mnServersService.getNodes().then(function (nodes) {
          if (prev_active_nodes && !nodeListsEqual(prev_active_nodes, nodes.active)) {
            updateValidNodes();
          }
          prev_active_nodes = nodes.active;
        });
      });

      $scope.changeExpandShadow = function (shadow) {
        shadow.expanded = !shadow.expanded;
      }

      // if we receive a query parameter, and it's not the same as the current query,
      // insert it at the end of history
      if (_.isString($stateParams.query) && $stateParams.query.length > 0 &&
        $stateParams.query != qc.lastResult.query) {
        cwQueryService.addNewQueryAtEndOfHistory($stateParams.query);
      }

      // Prevent the backspace key from navigating back. Thanks StackOverflow!
      $(document).unbind('keydown').bind('keydown', function (event) {
        var doPrevent = false;
        if (event.keyCode === 8) {
          var d = event.srcElement || event.target;
          if ((d.tagName.toUpperCase() === 'INPUT' &&
              (
                d.type.toUpperCase() === 'TEXT' ||
                d.type.toUpperCase() === 'PASSWORD' ||
                d.type.toUpperCase() === 'FILE' ||
                d.type.toUpperCase() === 'SEARCH' ||
                d.type.toUpperCase() === 'EMAIL' ||
                d.type.toUpperCase() === 'NUMBER' ||
                d.type.toUpperCase() === 'DATE')
            ) ||
            d.tagName.toUpperCase() === 'TEXTAREA') {
            doPrevent = d.readOnly || d.disabled;
          } else {
            doPrevent = true;
          }
        }

        if (doPrevent) {
          event.preventDefault();
        }
      });

      // schedule a timer to poll analytics stats
      if (!cwQueryService.pollShadowingStats) {
        cwQueryService.pollShadowingStats = $interval(function () {
          $rootScope.$broadcast("pollAnalyticsShadowingStats");
        }, statsRefreshInterval);

        $scope.$on('$destroy', function () {
          $interval.cancel(cwQueryService.pollShadowingStats);
          cwQueryService.pollShadowingStats = null;
        });
      }

      // get the list of buckets
      qc.updateBuckets();

      // load the AWS supported regions
      cwQueryService.getAwsSupportedRegions();

      //
      // now let's make sure the window is the right size
      //
      $timeout(updateEditorSizes(), 100);
    }

    // hide & show the datasets sidebar + the main navigation sidebar
    function toggleFullscreen() {
      if (!qc.fullscreen) {
        $(".insights-sidebar").removeClass("width-3");
        $(".insights-sidebar").addClass("fix-width-0");
        $(".wb-main-wrapper").removeClass("width-9");
        $(".wb-main-wrapper").addClass("width-12");
        $(".wb-refresh-btn").addClass("hidden");
        mnPoolDefault.setHideNavSidebar(true);
      } else {
        $(".insights-sidebar").removeClass("fix-width-0");
        $(".insights-sidebar").addClass("width-3");
        $(".wb-main-wrapper").removeClass("width-12");
        $(".wb-main-wrapper").addClass("width-9");
        $(".wb-refresh-btn").removeClass("hidden");
        mnPoolDefault.setHideNavSidebar(false);
      }
      qc.fullscreen = !qc.fullscreen;
    }

    function containsValidStatements(input) {
      var statements = input.split(";");
      var statementCount = 0;
      for (var i = 0; i < statements.length; i++) {
        var statement = statements[i].trim();
        if (statement.length === 0) {
          continue;
        }
        if (!qc.isAllowedMultiStatement(statement)) {
          statementCount++;
        }
      }
      return statementCount >= 1;
    }

    function lastResultWarnings() {
      let warnings = qc.lastResult.warnings;
      if (_.isString(warnings)) {
        return warnings.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;').replace(/'/g, '\\\'');
      }
      return warnings;
    }

    // since data sets can use links from other dataverses, we have a special structure to collect all the links used
    // by any dataset in a dataverse

    function getLinksInDataverse(dataverseName) {
      return cwQueryService.dataverse_links[dataverseName];
    }

    // convenience function to get the Local link for a given dataverse
    function getLocalLink(dataverse) {
      return cwQueryService.dataverse_links[dataverse.DataverseName]
        .find(element => element.LinkName == "Local");
    }

    function getDatasetsInLink(dataverse,link) {
      var result = [];
      qc.shadows.forEach(function(shadow) {
        // internal datasets
        if (shadow.DataverseName === dataverse.DataverseName && shadow.bucketDataverseName == link.DVName &&
            shadow.LinkName == link.LinkName)
          result.push(shadow);
        // external datasets
        if (shadow.DataverseName === dataverse.DataverseName && shadow.dataverse == link.DVName &&
            shadow.name == link.LinkName)
          result.push(shadow);
      });
      return result;
    }
    function disconnectLink(link,dataverse) {
      var queryText = "disconnect link " + dataverse.dataverseDisplayName + ".`" + link.LinkName + "`";
      link.remaining = qc.datasetUnknownState;
      cwQueryService.executeQueryUtil(queryText, false, false)
        .then(function success() {/*nothing to do*/
          },
          handleConnectionFailure);
    }

    function connectLink(link,dataverse) {
      var queryText = "connect link " + dataverse.dataverseDisplayName + ".`" + link.LinkName + "`";
      link.remaining = qc.datasetUnknownState;
      cwQueryService.executeQueryUtil(queryText, false, false)
        .then(function success() {/*nothing to do*/
          },
          handleConnectionFailure);
    }

    function handleConnectionFailure(resp) {
      var errorStr = "Error connecting/disconnecting link. "
      if (resp.status)
        errorStr += "Got status: " + resp.status + " from server.";
      if (resp.data)
        if (_.isString(resp.data))
          errorStr += "Error: " + resp.data;
        else if (resp.data.errors)
          errorStr += JSON.stringify(resp.data.errors);
        else
          errorStr += JSON.stringify(resp.data);

      cwQueryService.showErrorDialog(errorStr);
      console.log("Error connecting/disconnecting link: " + JSON.stringify(resp));
    }


    //
    // callbacks for creating new links and new datasets
    //

    var linkOptions = {
      link_name: "",
      link_type: "couchbase",
      dataverse: "",
      is_new: true,
      couchbase_link: {
        hostname: "",
        username: "",
        password: "",
        demand_encryption: false,
        encryption_type: "none",
        certificate: "",
        client_certificate: "",
        client_key: ""
      },
      s3_link: {
        access_key_id: "",
        access_key: "",
        region: "",
        endpoint: ""
      }
    };
    var linkDialogScope = $rootScope.$new(true);
    linkDialogScope.options = linkOptions;
    linkDialogScope.change_encryption = function() {
      if (!linkDialogScope.options.couchbase_link.demand_encryption)
        linkDialogScope.options.couchbase_link.encryption_type = "none";
      else
        linkDialogScope.options.couchbase_link.encryption_type = "half";
    }

    function createNewLink(dataverse) {
      linkDialogScope.options.dataverse = dataverse.DataverseName;
      linkDialogScope.options.is_new = true;
      linkDialogScope.options.aws_regions = cwQueryService.awsRegions;

      // bring up the dialog
      $uibModal.open({
        templateUrl: '../_p/ui/cbas/cw_cbas_link_dialog.html',
        scope: linkDialogScope
      }).result
        .then(function success(resp) {
          cwQueryService.createLink(linkDialogScope.options)
            .then(function success(resp) {
              qc.updateBuckets();
            }, function error(resp) {
              console.log("Got create link error: " + JSON.stringify(resp));
              var errorStr = "Error creating link: " + (resp.data ? resp.data : JSON.stringify(resp));
              cwQueryService.showErrorDialog(errorStr);
            });

        }, function error(resp) {
        });

    }

    function editLink(link) {
      //console.log("Edit Link");
      linkDialogScope.options.aws_regions = cwQueryService.awsRegions;

      // get the info about the link
      var linkInfo = cwQueryService.getCachedLinkInfo(link.DVName, link.LinkName);
      if (linkInfo) {
        cwQueryService.convertAPIdataToDialogScope(linkInfo, linkDialogScope.options);
        linkDialogScope.options.is_new = false;
        linkDialogScope.options.couchbase_link.password = ""; // is never stored
        linkDialogScope.options.s3_link.access_key = ""; // is never stored

        // bring up the dialog
        $uibModal.open({
          templateUrl: '../_p/ui/cbas/cw_cbas_link_dialog.html',
          scope: linkDialogScope
        }).result
          .then(function success(resp) {

            if (resp == "drop") {
              cwQueryService.showConfirmationDialog("Are you sure you want to delete link: `" +
                link.DVName + '`.`' + link.LinkName + '`')
                .then(function yes(resp) {
                  if (resp == "ok") {
                    var queryText = "drop link `" + link.DVName + '`.`' + link.LinkName + "`";
                    cwQueryService.executeQueryUtil(queryText, false, false)
                      .then(function success() {
                          qc.updateBuckets()
                        },
                        function error(resp) {
                          console.log("Got drop link error: " + JSON.stringify(resp));
                          var errorStr = "Error dropping link: " + (resp.data.errors ? JSON.stringify(resp.data.errors) : JSON.stringify(resp.data));
                          cwQueryService.showErrorDialog(errorStr);
                        });
                  }
                });
            }

            else if (resp == 'ok')
              cwQueryService.editLink(linkDialogScope.options)
              .then(function success(resp) {
                qc.updateBuckets();
              }, function error(resp) {
                console.log("Got create link error: " + JSON.stringify(resp));
                var errorStr = "Error creating link: " + (resp.data ? resp.data : JSON.stringify(resp));
                cwQueryService.showErrorDialog(errorStr);
              });

          }, function error(resp) {
          });
      }

    }

    //
    // creating new datasets
    //

    var datasetDialogScope = $rootScope.$new(true);

    var dataset_options = {
      dataset_name: "",
      where: "",
      is_new: true,
      bucket_name: "",
      selected_bucket: "", // used for local datasets
      selected_scope: "",
      selected_collection: "",
      external_dataset: {
        s3_path: "",
        format: "json",
        header: true,
        null_value: "",
        include: "",
        exclude: ""
      },
      // KV buckets, scopes, and collections
      kv_buckets: [],
      kv_scopes: {},
      kv_collections: {},
    };

    dataset_options.collectionMenuCallback = function(event) {
      if (event) {
        dataset_options.selected_bucket = event.bucket;
        dataset_options.selected_scope = event.scope;
        dataset_options.selected_collection = event.collection;
      }
    };

    dataset_options.update_buckets = function() {
      qwCollectionsService.getBuckets().then(function success(metadata) {
        dataset_options.kv_buckets.length = 0;
        for (const bucketName of metadata.buckets)
          dataset_options.kv_buckets.push({name:bucketName,expanded:false});
      });
    };

    dataset_options.update_scopes_for_bucket = function(bucket) {
      qwCollectionsService.getScopesForBucket(bucket)
        .then(function success(metadata) {
          dataset_options.kv_scopes[bucket] = [];
          metadata.scopes[bucket].forEach(scope_name =>
            dataset_options.kv_scopes[bucket].push({name: scope_name, expanded:false}));
          dataset_options.kv_collections[bucket] = metadata.collections[bucket];
        });
    };

    dataset_options.changeBucketExpanded = function(bucket) {
      bucket.expanded = !bucket.expanded;
      if (bucket.expanded && !dataset_options.kv_scopes[bucket.name])
        dataset_options.update_scopes_for_bucket(bucket.name);
    };

    dataset_options.changeScopeExpanded = function(scope) {
      scope.expanded = !scope.expanded;
    };

    // to handle selections, we have a map indexed by bucket, scope, & coll name
    dataset_options.collection_key = function(bucketName,scopeName,collectionName) {
      return(bucketName + '`' + scopeName + '`' + collectionName);
    };

    dataset_options.select_collection = function(bucketName,scopeName,collectionName) {
      var key = dataset_options.collection_key(bucketName,scopeName,collectionName);
      dataset_options.selected_collections[key] = !dataset_options.selected_collections[key];
    };

    dataset_options.selection_count = function() {
      var count = 0;
      for (const key in dataset_options.selected_collections)
        if (dataset_options.selected_collections[key])
          count++;
        return(count);
    };

    dataset_options.already_selected = function(bucketName,scopeName,collectionName) {
      var key = dataset_options.collection_key(bucketName,scopeName,collectionName);
      return(dataset_options.already_selected_collections[key]);
    };

    // need to get a map of currently mapped datasets
    function updateCurrentlySelectedCollections() {
      dataset_options.already_selected_collections = {};

      qc.shadows.forEach(function(shadow) {
        // internal datasets
        if (!shadow.external &&
        shadow.DataverseName.indexOf('.') > -1 &&
        shadow.LinkName == 'Local') {
          var bucket_scope = shadow.bucketDataverseName.split('.');
          var key = dataset_options.collection_key(bucket_scope[0],bucket_scope[1],shadow.id);
          dataset_options.already_selected_collections[key] = true;
        }
      });

    }

    // the 'enable analytics' command allows creation of a 1:1 mapping between collections and
    // analytics collections. Bring up a dialog box and allow selection of many collections,
    // and for each use 'enable analytics'
    function mapCollections() {
      dataset_options.update_buckets();
      updateCurrentlySelectedCollections();
      datasetDialogScope.options = dataset_options;
      dataset_options.selected_collections = {};
      // bring up the dialog
      $uibModal.open({
        templateUrl: '../_p/ui/cbas/cw_cbas_map_collections_dialog.html',
        scope: datasetDialogScope
      }).result
        .then(function success(resp) {
          var queries = [];
          for (const selection in dataset_options.selected_collections) {
            var details = selection.split('`');
            queries.push("alter collection `" + details[0] + "`.`" +
              details[1] + '`.`' + details[2] + '` enable analytics;');
          }
          executeQueryList(queries,0);
        },
        function error(resp) {
          // they hit cancel, nothing to do
        });
    }

    // execute a list of queries in sequence, stopping at the first error
    function executeQueryList(queryList, index) {
      if (index >= queryList.length) { // all done
        setTimeout(qc.updateBuckets, 500);
        return;
      }

      cwQueryService.executeQueryUtil(queryList[index], false, false)
        .then(function success() {
            executeQueryList(queryList,index+1);
          },
          function error(resp) {
            var errorStr = "Error running query: " + (resp.data.errors ? JSON.stringify(resp.data.errors) : JSON.stringify(resp.data));
            cwQueryService.showErrorDialog(errorStr);
          });
    }

    // create a custom dataset on a given link
    function createNewDataset(link) {
      //console.log("Creating new dataset for: " + JSON.stringify(link));
      if (link.LinkName == "Local")
        dataset_options.clusterBuckets = qc.clusterBuckets;
      else
        dataset_options.clusterBuckets = null;
      dataset_options.is_new = true;
      dataset_options.dataset_name = "";
      dataset_options.link_name = link.LinkName;
      dataset_options.link_details = cwQueryService.getCachedLinkInfo(link.DVName,link.LinkName);
      datasetDialogScope.options = dataset_options;

      // bring up the dialog
      $uibModal.open({
        templateUrl: '../_p/ui/cbas/cw_cbas_dataset_dialog.html',
        scope: datasetDialogScope
      }).result
        .then(function success(resp) {

          var external = (dataset_options.link_details && dataset_options.link_details.type == "s3") ? " EXTERNAL " : "";
          var queryText = "CREATE " + external + " DATASET `" + link.DVName + "`.`" + dataset_options.dataset_name +
            "` ON `" + dataset_options.selected_bucket;

          // pre-7.0 remote clusters won't have scope and collection.
          if (dataset_options.selected_scope && dataset_options.selected_collection)
            queryText += "`.`" + dataset_options.selected_scope + "`.`" +  dataset_options.selected_collection;

          queryText += "` at `" + link.DVName + "`.`" + link.LinkName + "`";

          if (dataset_options.where)
            queryText += " WHERE " + dataset_options.where;

          // external dataset?
          if (dataset_options.link_details && dataset_options.link_details.type == "s3") {
            if (dataset_options.external_dataset.s3_path)
              queryText += ' USING "' + dataset_options.external_dataset.s3_path + '"';
            queryText += ' WITH {"format": "' + dataset_options.external_dataset.format + '"';
            if (dataset_options.external_dataset.format != "json") {
              queryText += ', "header": ' + dataset_options.external_dataset.header;
              if (dataset_options.external_dataset.null_value)
                queryText += ', "null": "' + dataset_options.external_dataset.null_value + '"';
            }
            if (dataset_options.external_dataset.include)
              queryText += ', "include": ' + dataset_options.external_dataset.include;

            if (dataset_options.external_dataset.exclude)
              queryText += ', "exclude": ' + dataset_options.external_dataset.exclude;

            queryText += " }";
          }

          //console.log("Got create query: " + queryText);

          cwQueryService.executeQueryUtil(queryText, false, false)
            .then(function success() {
                qc.updateBuckets()
              },
              function error(resp) {
                console.log("Got create dataset error: " + JSON.stringify(resp));
                var errorMsg;
                if (resp && resp.data && _.isArray(resp.data.errors) && resp.data.errors[0] && resp.data.errors[0].msg)
                  errorMsg = resp.data.errors[0].msg;
                else if (resp && resp.data && _.isArray(resp.data.errors))
                  errorMsg = JSON.stringify(resp.data.errors);
                else if (resp.data)
                  errorMsg = JSON.stringify(resp.data);
                var errorStr = "Error creating dataset: " + errorMsg;
                cwQueryService.showErrorDialog(errorStr);
              });

        }, function error(resp) {
        });
    }

    function editDataset(link, dataset) {
      dataset_options.clusterBuckets = null;
      dataset_options.link_name = link.LinkName;
      dataset_options.is_new = false;
      dataset_options.dataset_name = dataset.id;
      dataset_options.where = dataset.filter;
      dataset_options.bucket_name = dataset.bucketName;

      datasetDialogScope.options = dataset_options;

      // bring up the dialog
      $uibModal.open({
        templateUrl: '../_p/ui/cbas/cw_cbas_dataset_dialog.html',
        scope: datasetDialogScope
      }).result
        .then(function success(resp) {
          //console.log("showed dataset, got resp: " + resp);
          if (resp == "drop") {
            cwQueryService.showConfirmationDialog("Are you sure you want to delete dataset: " +
              link.DVName + "." + dataset.id)
              .then(function yes(resp) {
                if (resp == "ok") {
                  var queryText = "drop dataset " + dataset.dataverseDisplayName + ".`" + dataset_options.dataset_name + "`";

                  cwQueryService.executeQueryUtil(queryText, false, false)
                    .then(function success() {
                        qc.updateBuckets();
                      },
                      function error(resp) {
                        console.log("Got drop dataset error: " + JSON.stringify(resp));
                        var errorStr = "Error dropping dataset: " + (resp.data.errors ? JSON.stringify(resp.data.errors) : JSON.stringify(resp.data));
                        cwQueryService.showErrorDialog(errorStr);
                      });

                }
              });
          }
        }, function error(resp) {
        });
    }


  } // end of CBasController function

  function forceReload(url) {
    if (window.location.href == url) {
      location.reload();
    }
  }

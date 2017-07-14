(function() {

  //
  // the cwConstantsService contains a number of constants used by the query workbench, such as
  // queries, URL prefixes, etc. This version is defined for the regular query workbench inside
  // the Couchbase admin UI, a different version will be defined for CBAS, and for the stand-alone
  // version
  //

  angular.module('cwCbas').factory('cwConstantsService', getCwConstantsService);

  getCwConstantsService.$inject = [];

  function getCwConstantsService() {

    var cwConstantsService = {};

    // do we automatically run queries if the user clicks enter after a semicolon?
    cwConstantsService.autoExecuteQueryOnEnter = false;

    // don't allow multiple queries to run at once
    cwConstantsService.forbidMultipleQueries = false;

    // URL to use for running queries
    cwConstantsService.queryURL = "../_p/cbas/query/service";

    // should we get passwords from the Couchbase server?
    cwConstantsService.getCouchbaseBucketPasswords = false;

    // should we run 'explain' in the background for each query?
    cwConstantsService.autoExplain = false;

    // should we show the bucket analysis pane at all?
    cwConstantsService.showBucketAnalysis = true;

    // allow a suffix to the key used for local storage
    cwConstantsService.localStorageSuffix = "cbas";

    // query language mode for ACE editor
    cwConstantsService.queryMode = 'sql-plus-plus';

    // should queries include an array of credentials? ("creds")
    cwConstantsService.sendCreds = false;

    // the following query asks Couchbase for a list of keyspaces, returning the 'id',
    // and a 'has_prim' boolean indicating whether or not it has a primary index, and
    // 'has_sec' indicating secondary indexes. For a different system, just make sure
    // the returned schema has 'id' and 'has_prim'.
    cwConstantsService.keyspaceQuery =
      "select Name as id, true as is_bucket from Metadata.`Bucket` union all " +
      "select DatasetName as id, true as is_shadow from Metadata.`Dataset` where BucketName is not missing;";

    // should we permit schema inquiries in the bucket analysis pane?
    cwConstantsService.showSchemas = false;

    // labels for different types of buckets in the analysis pane
    cwConstantsService.analysisFirstSection = "Buckets";
    cwConstantsService.analysisSecondSection = "Shadow Datasets";

    //
    //
    //
    // all done creating the service, now return it
    //

    return cwConstantsService;
  }



})();
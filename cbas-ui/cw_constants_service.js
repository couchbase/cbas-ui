import angular from "/ui/web_modules/angular.js";

export default 'cwConstantsService';

angular
  .module('cwConstantsService', [])
  .factory('cwConstantsService', getCwConstantsService);



//
// the cwConstantsService contains a number of constants used by the query workbench, such as
// queries, URL prefixes, etc. This version is defined for the regular query workbench inside
// the Couchbase admin UI, a different version will be defined for CBAS, and for the stand-alone
// version
//



function getCwConstantsService() {

  var cwConstantsService = {};

  // do we automatically run queries if the user clicks enter after a semicolon?
  cwConstantsService.autoExecuteQueryOnEnter = true;

  // don't allow multiple queries to run at once
  cwConstantsService.forbidMultipleQueries = false;

  // URL to use for running queries
  cwConstantsService.queryURL = "../_p/cbas/query/service";

  // URL to use to cancel running queries
  cwConstantsService.canelQueryURL = "../_p/cbas/analytics/admin/active_requests";

  // URL to use to get the bucket connection state
  cwConstantsService.bucketStateURL = "../_p/cbas/analytics/buckets";

  // URL to get user visible buckets
  cwConstantsService.clusterBucketsURL = "../pools/default/buckets";

  // URL to use to get the analytics stats
  // TODO switch back to ../_p/cbas/analytics/status/ingestion
  cwConstantsService.analyticsStatsURL = "../_p/cbas/analytics/status/ingestion/v2";

  // URL to use to get AWS supported regions
  cwConstantsService.awsRegionsURL = "../_p/cbas/analytics/link/enum/s3/region";

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

  // query id parameter name (for query cancellation)
  cwConstantsService.queryIdParam = "client_context_id";

  // the following query asks Couchbase for a list of keyspaces, returning the 'id',
  // and a 'has_prim' boolean indicating whether or not it has a primary index, and
  // 'has_sec' indicating secondary indexes. For a different system, just make sure
  // the returned schema has 'id' and 'has_prim'.
  cwConstantsService.keyspaceQuery =
      "SELECT " +
      "  DataverseName, " +
      "  DataverseName || '.' || DatasetName AS datasetFullyQualifiedName, " +
      "  decode_dataverse_display_name(DataverseName) AS dataverseDisplayName, " +
      "  DatasetName AS id, " +
      "  TRUE AS isDataset, " +
      "  BucketName AS bucketName, " +
      "  BucketDataverseName as bucketDataverseName, " +
      "  `Filter` AS `filter`, " +
      "  LinkName,  " +
      "  DatasetType,  " +
      "  ( SELECT " +
      "      idx.IndexName, " +
      "      idx.SearchKey, " +
      "      idx.SearchKeyType " +
      "    FROM " +
      "      Metadata.`Index` AS idx " +
      "    WHERE idx.IsPrimary = false " +
      "      AND idx.DatasetName = ds.DatasetName" +
      "      AND idx.DataverseName = ds.DataverseName) AS indexes, " +
      "      ExternalDetails.Properties AS externalDetails " +
      "FROM " +
      "  Metadata.`Dataset` AS ds " +
      "WHERE " +
      "  (BucketName IS NOT missing OR  DatasetType = 'EXTERNAL')" +
      "UNION ALL " +
      "SELECT " +
      "  dv.DataverseName, " +
      "  decode_dataverse_display_name(dv.DataverseName) AS dataverseDisplayName, " +
      "  TRUE AS isDataverse, " +
      "  ( SELECT " +
      "      l.Name " +
      "    FROM " +
      "      Metadata.`Link` AS l " +
      "    WHERE " +
      "      l.DataverseName = dv.DataverseName) AS links " +
      "FROM " +
      "  Metadata.`Dataverse` AS dv " +
      "WHERE " +
      "  dv.DataverseName != 'Metadata' " +
      "UNION ALL " +
      "SELECT " +
      "  DataverseName, " +
      "  Name, " +
      "  `Type` as LinkType, " +
      "  TRUE as isLink " +
      "FROM " +
      "  Metadata.`Link`;";

  // should we permit schema inquiries in the bucket analysis pane?
  cwConstantsService.showSchemas = false;

  // labels for different types of buckets in the analysis pane
  cwConstantsService.analysisFirstSection = "Datasets";
  cwConstantsService.analysisSecondSection = "Cluster Buckets";

  // list of trigger queries to update update the bucket insights after
  cwConstantsService.bucketInsightsUpdateTriggers = ["CREATE DATAVERSE", "DROP DATAVERSE", "CONNECT LINK", "DISCONNECT LINK",
                                                     "CREATE DATASET", "CREATE EXTERNAL DATASET", "DROP DATASET", "CREATE INDEX",
                                                     "DROP INDEX", "CREATE ANALYTICS COLLECTION", "DROP ANALYTICS COLLECTION",
                                                     "CREATE ANALYTICS SCOPE", "DROP ANALYTICS SCOPE", "ALTER COLLECTION"];

  cwConstantsService.healthCheckURL = "../_p/cbas/admin/ping";

  // should we show the query options button?
  cwConstantsService.showOptions = true;

  // default max warnings returned by user queries
  cwConstantsService.maxWarnings = 10;

  //
  //
  // all done creating the service, now return it
  //

  return cwConstantsService;
}

/*
Copyright 2017-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";

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
    "select meta.* from (SELECT " +
    "  ds.DataverseName, " +
    "  ds.DataverseName || '.' || ds.DatasetName AS datasetFullyQualifiedName, " +
    "  ds.DatasetName AS id, " +
    "  TRUE AS isDataset, " +
    "  ds.BucketName AS bucketName, " +
    "  ds.ScopeName AS scopeName, " +
    "  ds.CollectionName AS collectionName, " +
    "  ds.BucketDataverseName as linkDataverseName, " +
    "  ds.`Filter` AS `filter`, " +
    "  ds.LinkName,  " +
    "  ds.DatasetType,  " +
    "  ds.ViewDetails,  " +
    "  concat2(', ', (select value FieldName || ' ' || (" +
    "          CASE WHEN lower(FieldType) = 'int64' THEN 'BIGINT'" +
    "               ELSE upper(FieldType) END) || (" +
    "          CASE WHEN NOT IsNullable AND NOT IsMissable THEN ' IS NOT UNKNOWN'" +
    "               ELSE '' END)" +
    "        from t.Derived.Record.Fields)) AS TypeString," +
    "  ( SELECT " +
    "      idx.IndexName, " +
    "      idx.SearchKey, " +
    "      idx.SearchKeyType " +
    "    FROM " +
    "      Metadata.`Index` AS idx " +
    "    WHERE idx.IsPrimary = false " +
    "      AND idx.DatasetName = ds.DatasetName" +
    "      AND idx.DataverseName = ds.DataverseName) AS indexes, " +
    "   ds.ExternalDetails.Properties AS externalDetails " +
    "FROM " +
    "  Metadata.`Dataset` AS ds left join Metadata.Datatype t on" +
    "  ds.DataverseName = t.DataverseName and t.DatatypeName = ds.DatatypeName " +
    "WHERE " +
    "  (ds.BucketName IS NOT missing OR  ds.DatasetType = 'EXTERNAL' OR ds.DatasetType = 'VIEW')" +
    "UNION ALL " +
    "SELECT " +
    "  dv.DataverseName, " +
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
    "  IsActive, " +
    "  `Type` as LinkType, " +
    "  TRUE as isLink " +
    "FROM " +
    "  Metadata.`Link`) meta order by meta.isDataverse desc, meta.isLink desc;"; // make sure dataverses first, then links, then datasets

  // for mixed clusters, use the 6.6 version of the query
  cwConstantsService.keyspaceQuery6_6 =
    "select i.* from (SELECT " +
    "  DataverseName, " +
    "  DataverseName || '.' || DatasetName AS fullName, " +
    "  DatasetName AS id, " +
    "  TRUE AS isDataset, " +
    "  BucketName AS bucketName, " +
    "  BucketDataverseName as linkDataverseName, " +
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
    "  (BucketName IS NOT missing OR DatasetType = 'EXTERNAL')" +
    "UNION ALL " +
    "SELECT " +
    "  dv.DataverseName, " +
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
    "  Metadata.`Link`) i order by i.isDataverse desc, i.isLink desc;";

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

  // external collection constants start
  cwConstantsService.externalCollectionTypes = ['s3', 'azureblob', 'azuredatalake', 'gcs'];
  cwConstantsService.supportedExternalCollectionFormats = ['json', 'csv', 'tsv'];
  cwConstantsService.linkTypesSupportingParquet = ['s3', 'azureblob'];

  cwConstantsService.isExternalCollection = function (type) {
    return cwConstantsService.externalCollectionTypes.includes(type)
  };

  cwConstantsService.requireTypeDefinition = function (format) {
    return ['csv', 'tsv'].includes(format);
  };

  cwConstantsService.isParquetSupported = function (linkType) {
    return cwConstantsService.linkTypesSupportingParquet.includes(linkType);
  };
  // external collection constants end

  //
  //
  // all done creating the service, now return it
  //

  return cwConstantsService;
}

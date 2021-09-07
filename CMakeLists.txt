#
# CMakeLists.txt for cbas-ui
#
# We need to copy the pluggable-ui-cbas.json to install/etc/couchbase,
# and copy everything else to install/lib/cbas-ui
#
CMAKE_MINIMUM_REQUIRED (VERSION 3.13)

PROJECT (cbas-ui)

# installed system now uses relative path, so no prefix
SET (_instdir "${PROJECT_BINARY_DIR}")
SET (BIN_PREFIX "")

# rewrite the config file for installation
configure_file (pluggable-ui-cbas.json.in pluggable-ui-cbas.json)

# copy rewritten config file and code to install directory
install(FILES "${_instdir}/pluggable-ui-cbas.json"
        DESTINATION etc/couchbase)

install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/cbas-ui
        DESTINATION lib
        REGEX libs-standalone EXCLUDE
        PATTERN "*standalone.*" EXCLUDE)

# rewrite the config file for running locally (using cluster-run)
SET (BIN_PREFIX "${CMAKE_CURRENT_SOURCE_DIR}/")
configure_file (pluggable-ui-cbas.json.in ${_instdir}/../cluster_run_ui_plugins/pluggable-ui-cbas.cluster_run.json)

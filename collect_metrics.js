const { stringify } = require('csv-stringify');
const fs = require('fs');
const path = require('path');
const urllib = require('urllib');
const CONFIG = require('./config');

// --- Configuration ---
// Replace with your Ops Manager API details
const BASE_URL = CONFIG[CONFIG.MODE].BASE_URL || CONFIG.OPS_MANAGER.BASE_URL;
const PUBLIC_API_KEY = CONFIG[CONFIG.MODE].PUBLIC_API_KEY;
const PRIVATE_API_KEY = CONFIG[CONFIG.MODE].PRIVATE_API_KEY;
const METRIC_PERIOD_DAYS = CONFIG.METRIC_PERIOD_DAYS || 1; // Default to 1 month if not set in config
const METRIC_GRANULARITY_HOURS = CONFIG.METRIC_GRANULARITY_HOURS || 24; // Default to 24 hours if not set in config

// Output file name
const OUTPUT_FILENAME = `MongoDB_Util_Report_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
const OUTPUT_DIR = path.join(__dirname, 'output');

const METRICS = [
  'DISK_PARTITION_READ_IOPS_DATA',
  'DISK_PARTITION_WRITE_IOPS_DATA',
  'DISK_PARTITION_IOPS_READ',
  'DISK_PARTITION_IOPS_WRITE',
  'DISK_PARTITION_IOPS_TOTAL',
  'DISK_PARTITION_SPACE_USED',
  'DISK_PARTITION_SPACE_FREE',
  'SYSTEM_NORMALIZED_CPU_USER',
  'PROCESS_NORMALIZED_CPU_USER',
  'SYSTEM_MEMORY_USED',
  'SYSTEM_MEMORY_FREE_MB',
  'SYSTEM_MEMORY_AVAILABLE',
  'DB_DATA_SIZE_TOTAL',
  'DB_DATA_SIZE_TOTAL_WO_SYSTEM',
  'DB_INDEX_SIZE_TOTAL',
  'DB_STORAGE_TOTAL',
  'OPCOUNTERS_INSERT',
  'OPCOUNTERS_QUERY',
  'OPCOUNTERS_UPDATE',
  'OPCOUNTERS_DELETE',
  'OPCOUNTERS_GETMORE',
  'OPCOUNTERS_COMMAND',
  'CACHE_BYTES_READ_INTO',
  'CACHE_BYTES_WRITTEN_FROM',
  'OPLOG_RATE_GB_PER_HOUR'
];

// const MEASUREMENT_UNITS = {
//   "PERCENT": "(%)",
//   "MILLISECONDS": "(ms)",
//   "BYTES": "(B)",
//   "GIGABYTES": "(GB)",
//   "BYTES_PER_SECOND": "(B/s)",
//   "MEGABYTES_PER_SECOND": "(MB/s)",
//   "GIGABYTES_PER_HOUR": "(GB/h)",
//   "SCALAR_PER_SECOND": "(scalar/s)",
//   "SCALAR": "scalar"
// };

// --- API Helper Functions ---

async function makeApiRequest(method, endpoint, params = {}, data = null) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(url);

  // urllib supports digest auth via 'digestAuth' option
  const headers = {
    "Accept": CONFIG[CONFIG.MODE].HEADERS || "application/json", // Use the configured header based on mode
    "Content-Type": "application/json"
  };

  try {
    const options = {
      method,
      headers,
      searchParams: params,
      timeout: 30000,
      data: data ? JSON.stringify(data) : undefined,
      dataType: 'json',
      digestAuth: `${PUBLIC_API_KEY}:${PRIVATE_API_KEY}`
    };
    const result = await urllib.request(url, options);
    return result.data;
  } catch (error) {
    if (error.status) {
      console.error(`HTTP error occurred: ${error.status} - ${error.statusText} - ${JSON.stringify(error.data)}`);
    } else {
      console.error(`Request error: ${error.message}`);
    }
    return null;
  }
}

async function getAllProjects() {
  console.log("Fetching all projects...");
  const projectsData = await makeApiRequest("GET", "/groups");
  console.log(projectsData);
  return projectsData && projectsData.results ? projectsData.results : [];
}

async function getProjectHosts(projectId) {
  console.log(`Workspaceing hosts for project ${projectId}...`);
  const hostsData = await makeApiRequest("GET", `/groups/${projectId}/${CONFIG.MODE === "ATLAS" ? "processes" : "hosts"}`);
  return hostsData && hostsData.results ? hostsData.results : [];
}

async function getNodeMetrics(projectId, hostname, hostId) {
  const row = {};

  // Use encoded URL parameters for BURL-style query parameters as a string
  const params = `period=${encodeURIComponent(`P${METRIC_PERIOD_DAYS}D`)}&granularity=${encodeURIComponent(`PT${METRIC_GRANULARITY_HOURS}H`)}`;
  console.log(`Fetching metrics for ${hostname}...`);

  const metricsData = await makeApiRequest("GET", `/groups/${projectId}/${CONFIG.MODE === "ATLAS" ? "processes" : "hosts"}/${hostId}/measurements?${params}`);
  const disksData = await makeApiRequest("GET", `/groups/${projectId}/${CONFIG.MODE === "ATLAS" ? "processes" : "hosts"}/${hostId}/disks`);

  if (disksData && disksData.results && disksData.results.length > 0) {
    for (const disk of disksData.results) {
      const partitionName = disk.partitionName;
      // Fetch disk IOPS metrics for this partition
      const diskMetricsData = await makeApiRequest(
        "GET",
        `/groups/${projectId}/${CONFIG.MODE === "ATLAS" ? "processes" : "hosts"}/${hostId}/disks/${encodeURIComponent(partitionName)}/measurements?${params}`
      );
      if (diskMetricsData && diskMetricsData.measurements && diskMetricsData.measurements.length > 0) {
        for (const measurement of diskMetricsData.measurements) {
          if (!METRICS.includes(measurement.name)) continue;
          const { min, max, median } = generateMinMaxMedian(measurement.dataPoints);
          row[`${partitionName}_${measurement.name}_MIN`] = min;
          row[`${partitionName}_${measurement.name}_MAX`] = max;
          row[`${partitionName}_${measurement.name}_MEDIAN`] = median;
        }
      }
    }
  }
  
  // fs.writeFileSync(path.join(OUTPUT_DIR, 'measurements.json'), JSON.stringify(metricsData, null, 2));

  if (metricsData && metricsData.measurements && metricsData.measurements.length > 0) {
    for (const measurement of metricsData.measurements) {
      // Only process measurements whose name is in the METRICS array
      if (!METRICS.includes(measurement.name)) continue;

      const { min, max, median } = generateMinMaxMedian(measurement.dataPoints);
      row[`${measurement.name}_MIN`] = min;
      row[`${measurement.name}_MAX`] = max;
      row[`${measurement.name}_MEDIAN`] = median;
    }
  }

  return row;
}

function generateMinMaxMedian(dataPoints) {
  const values = dataPoints.map(dp => dp.value);
  const sorted = [...values].sort((a, b) => a - b);
  // Calculate median
  let median;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    min: min,
    max: max,
    median: median
  };
}

async function generateUtilizationReport() {
  const reportData = [];
  const projects = await getAllProjects();

  if (!projects || projects.length === 0) {
    console.log("No projects found or unable to retrieve projects. Exiting.");
    return;
  }

  let extractedMetrics = null;
  for (const project of projects) {
    const projectId = project.id;
    const projectName = project.name;
    console.log(`\nProcessing project: ${projectName} (ID: ${projectId})`);

    const hosts = await getProjectHosts(projectId);
    if (!hosts || hosts.length === 0) {
      console.log(`  No hosts found for project ${projectName}. Skipping.`);
      continue;
    }

    for (const host of hosts) {
      const row = {};
      // Initialize row with all headers to ensure consistent column order
      for (const header of METRICS) {
        row[header] = null;
      }

      const hostId = host.id;
      const hostname = host.hostname;
      const replicaSetName = host.replicaSetName || "N/A";
      const clusterType = host.typeName || "UNKNOWN"; // MONGOD, MONGOS, CONFIG_SERVER, etc.
      const systemInfo = host.systemInfo || { "memSizeMB" : 0, "numCores" : 0 }; 

      console.log('hosts', host);
      
      // Populate basic host information
      row["NODE_TYPE"] = clusterType;
      row["REPLICA_SET"] = replicaSetName;
      row["HOSTNAME"] = hostname;
      row["SYSTEM_MEMORY_MB"] = systemInfo.memSizeMB;
      row["SYSTEM_NUM_CORES"] = systemInfo.numCores;

      // Get metrics
      const metrics = await getNodeMetrics(
        projectId,
        hostname,
        hostId
      );
      if (!metrics) {
        console.warn(`  No metrics found for host ${memberName}. Skipping.`);
        continue;
      }
      if (extractedMetrics === null) {
        extractedMetrics = Object.keys(metrics);
      }
      reportData.push({ ...row, ...metrics });
    }
  }

  if (reportData.length > 0) {
    const columns = ["NODE_TYPE", "REPLICA_SET", "HOSTNAME", "SYSTEM_MEMORY_MB", "SYSTEM_NUM_CORES", ...extractedMetrics]; // Use the defined order of headers
    stringify(reportData, { header: true, columns: columns }, (err, output) => {
      if (err) {
        console.error("Error generating CSV:", err);
        return;
      }

      fs.writeFile(path.join(OUTPUT_DIR, OUTPUT_FILENAME), output, (writeErr) => {
        if (writeErr) {
          console.error("Error writing CSV file:", writeErr);
        } else {
          console.log(`\nReport generated successfully: ${OUTPUT_FILENAME}`);
        }
      });
    });
  } else {
    console.log("No data collected. Report not generated.");
  }
}

// --- Main Script ---

// Check if API keys and URL are set
if (CONFIG[CONFIG.MODE].BASE_URL.includes("YOUR_BASE_URL") || CONFIG[CONFIG.MODE].PUBLIC_API_KEY.includes("YOUR_PUBLIC_API_KEY") || CONFIG[CONFIG.MODE].PRIVATE_API_KEY.includes("YOUR_PRIVATE_API_KEY")) {
  console.warn("WARNING: Please update BASE_URL, PUBLIC_API_KEY, and PRIVATE_API_KEY in the script before running.");
} else {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  generateUtilizationReport();
}
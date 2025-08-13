# MDB Sizing OM Atlas

This project collects metrics fro Ops Manager to assist with Atlas sizing

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- Ops Manager API Key - role with read-only access should be sufficient

## Install Dependencies

```bash
npm install
```

## Create config.json

- Copy `config.json.sample` to a new `config.json` file
- Update the value for `MODE` to indicate which system to retrieve metrics from. Options: `OPS_MANAGER` or `ATLAS`
- To collect Ops Manager metrics, update the values for `BASE_URL`, `PUBLIC_API_KEY`, and `PRIVATE_API_KEY` in the OPS_MANAGER section.
- To collect Atlas metrics, update the values for `PUBLIC_API_KEY` and `PRIVATE_API_KEY` in the ATLAS section.

## Running the Script

To collect metrics, run:

```bash
node collect_metrics.js
```

This will collect metrics for all projects. To limit the execution to specific projects, add the project names to the `TARGET_PROJECT_NAMES` array in `config.json`.

```
"TARGET_PROJECT_NAMES": [ "Project0", "Project1" ],
```


## Outputs

The collected information will be stored as CSV files in the `output/` directory.

| NODE_TYPE        | SHARD_NAME | REPLICA_SET | HOSTNAME                                   | SYSTEM_MEMORY_MB | SYSTEM_NUM_CORES | xvda1_DISK_PARTITION_IOPS_READ_MIN | xvda1_DISK_PARTITION_IOPS_READ_MAX | xvda1_DISK_PARTITION_IOPS_READ_MEDIAN | xvda1_DISK_PARTITION_IOPS_WRITE_MIN | ...|
|------------------|------------|-------------|---------------------------------------------|------------------|------------------|-------------------------------------|-------------------------------------|--------------------------------------|-------------------------------------|-------------------------------------|
| REPLICA_SECONDARY | N/A        | myReplicaSet         | hostname1               | 2048             | 1                | 0.0018000765673057322               | 0.038825034431412137               | 0.004371618839804064                | 2.9296860664295497                  |...|
| REPLICA_PRIMARY   | N/A        | myReplicaSet         | hostname2 | 2048             | 1                | 0.002017062882574804                | 0.040670432403318024               | 0.0054874356126067315               | 2.8499025549467407                  |...|
| REPLICA_SECONDARY | N/A        | myReplicaSet         | hostname3  | 2048             | 1                | 0.0031980772029527845               | 0.047314351764943044               | 0.008338095162700902                | 2.699482506432672                   | ...|

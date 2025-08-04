# MDB Sizing OM Atlas

This project collects metrics using Node.js.

## Prerequisites

- [Node.js](https://nodejs.org/) installed

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

## Node Imports

The `collect_metrics.js` script uses standard Node.js modules and any dependencies listed in `package.json`.

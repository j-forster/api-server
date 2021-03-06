"use strict";

const access = require('./access.js');
const { AccessLevel, servicePathProtection, getServicePathFromHeader } = access;
const request = require('request');
const http = require('http');
const config = require('../config.js');
const MongoClient = require('mongodb').MongoClient
const assert = require('assert');

//get all values for a sensor measurement
async function getSensorMeasurementValues(domain, sensorID, measID) {
  
  return getEntityMeasurementValues(domain, sensorID, "SensingDevice", measID);
}

async function getEntityMeasurementValues(domain, entityID, entityType, measID) {
  var docs = await mongoRequest(domain, col => col.find({ entityID, entityType, attributeID: measID }).toArray());
  return docs.map(getMeasurement)
}

//insert all datapoints for a new sensor
async function postSensorMongo(domain, sensor) {
  var docs = getSensorDatapoints(sensor);
  console.log("postSensorMongo:" + JSON.stringify(docs));
  mongoRequest(domain, col => col.insertMany(docs));
}

//insert all datapoints for a new sensor
async function postSensorMeasMongo(domain, sensorID, meas) {
  var docs = getEntityMeasDatapoints(sensorID, "SensingDevice", meas);
  mongoRequest(domain, col => col.insertMany(docs));
}

//delete all datapoints belonging to a sensor
async function deleteEntityMongo(domain, entityID, entityType) {
  mongoRequest(domain, col => col.deleteMany({entityID, entityType}));
}

//create one datapoint for a sensor measurement (add the point the the list of measurements)
async function postDatapointMongo(domain, entityID, entityType, measID, datapoint) {
  var doc = getMongoDocument(entityID, entityType, measID, datapoint.value, new Date(datapoint.timestamp));
  mongoRequest(domain, col => col.insert(doc));
}

//create one datapoint for a sensor measurement (add the point the the list of measurements)
async function postValueMongo(domain, entityID, entityType, measID, value) {
  var doc = getMongoDocument(entityID, entityType, measID, value);
  mongoRequest(domain, col => col.insert(doc));
}

// create multiple datapoints
// measWithValues is like {meas1: [val1, val2], meas2: [val3]}
async function postValuesMongo(domain, entityID, entityType, measWithValues) {
  var docs = [];
  for(var measID in measWithValues)
    docs = docs.concat(... measWithValues[measID].map(meas => getMongoDocument(entityID, entityType, measID, meas)));
  
  mongoRequest(domain, col => col.insertMany(docs));
}


//delete all datapoints for a entity measurement
async function deleteEntityMeasMongo(domain, entityID, entityType, measID) {
  mongoRequest(domain, col => col.deleteMany({entityID, entityType, attributeID: measID}));
}

//performs a request into Mongo database
async function mongoRequest(domain, request) {
  const db = await MongoClient.connect(config.backend.mongoDBUrl);
  var res = request(db.collection(config.mongoPrefix + '-' + domain));
  db.close();
  return res;
}

// ## Helper functions ##

function getSensorDatapoints(sensor) {

  var datapoints = []
  for(let meas of sensor.measurements) {
    let dts = getEntityMeasDatapoints(sensor.id, "SensingDevice", meas);
    dts.forEach(a => datapoints.push(a))
  }
  return datapoints
}


function getEntityMeasDatapoints(entityID, entityType, meas) {
  var datapoints = []
  for(let val of meas.values) {
     console.log('val:' + JSON.stringify(val));
     datapoints.push(getMongoDocument(entityID, entityType, meas.id, val.value, new Date(val.timestamp)))
  }
  return datapoints;
}

function getMeasurements(docs) {
   return docs.map(getMeasurement);
}

function getMeasurement(doc) {

  return {
     timestamp: doc.timestamp,
     value: doc.value
   }
}

function getMongoDocument(entityID, entityType, measID, value, timestamp=new Date()) {

  var doc = {
    entityID,
    entityType,
    attributeID: measID,
    value
  };
  
  if(timestamp)
    doc.timestamp = timestamp;
  
  return doc;
}

module.exports = {
   getSensorMeasurementValues,
   postSensorMongo,
   postSensorMeasMongo,
   postDatapointMongo,
  
   getEntityMeasurementValues,
   postValuesMongo,
   postValueMongo,
   deleteEntityMongo,
   deleteEntityMeasMongo,
};

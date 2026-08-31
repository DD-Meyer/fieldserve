const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require("path");
 
/** @type {import('expo/metro-config').MetroConfig} */

// Load .env from parent directory (FieldServe)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = getDefaultConfig(__dirname);
 
module.exports = withNativewind(config);
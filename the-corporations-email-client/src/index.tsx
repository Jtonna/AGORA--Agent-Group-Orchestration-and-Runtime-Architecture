#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { loadMailConfig } from './utils/mailConfig.js';

// Load mail config synchronously at startup
const mailConfig = loadMailConfig();

render(<App subjectPrefixes={mailConfig.subjectPrefixes} />);

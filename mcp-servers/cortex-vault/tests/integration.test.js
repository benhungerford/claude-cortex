const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');

function sendMessage(proc, obj) {
  const json = JSON.stringify(obj);
  proc.stdin.write(json + '\n');
}

function collectResponses(proc, timeout) {
  return new Promise((resolve) => {
    let buffer = '';
    const responses = [];
    proc.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try { responses.push(JSON.parse(trimmed)); } catch {}
      }
    });
    setTimeout(() => {
      proc.kill();
      resolve(responses);
    }, timeout);
  });
}

describe('cortex-vault integration', () => {
  it('server starts and responds to initialize', async () => {
    const proc = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

    sendMessage(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    const responses = await collectResponses(proc, 2000);

    assert.ok(responses.length > 0, 'expected at least one response');
    const initResponse = responses.find(r => r.id === 1);
    assert.ok(initResponse, 'expected response with id:1');
    assert.ok(initResponse.result, 'expected result in response');
    assert.ok(initResponse.result.protocolVersion, 'expected protocolVersion in result');
    assert.ok(initResponse.result.serverInfo, 'expected serverInfo in result');
    assert.equal(initResponse.result.serverInfo.name, 'cortex-vault');
  });

  it('server lists all 10 tools', async () => {
    const proc = spawn('node', [SERVER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

    sendMessage(proc, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    await new Promise(r => setTimeout(r, 500));

    sendMessage(proc, {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    await new Promise(r => setTimeout(r, 500));

    sendMessage(proc, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    const responses = await collectResponses(proc, 2000);

    const toolsResponse = responses.find(r => r.id === 2);
    assert.ok(toolsResponse, 'expected response with id:2');
    assert.ok(toolsResponse.result, 'expected result in tools/list response');
    assert.ok(Array.isArray(toolsResponse.result.tools), 'expected tools to be an array');
    assert.equal(toolsResponse.result.tools.length, 10, `expected 10 tools, got ${toolsResponse.result.tools.length}`);
  });
});

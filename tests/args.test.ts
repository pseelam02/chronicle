import {test} from 'node:test';import assert from 'node:assert/strict';import {parseArgs} from '../packages/cli/args.ts';
test('CLI defaults and explicit options',()=>{assert.equal(parseArgs([]).path,'.');assert.equal(parseArgs(['a b','--no-ai','--port','4317']).port,4317);assert.equal(parseArgs(['--no-ai']).ai,false);});
test('CLI rejects ambiguity and invalid values',()=>{for(const a of [['--port','-1'],['--ref'],['a','b'],['--wat'],['--checkpoints','99']])assert.throws(()=>parseArgs(a));});

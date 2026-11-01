const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(`${__dirname}/popup.js`, 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 10));

function criarTela({total = 1, hostname = 'portalconsultor.dgbtecnologia.com.br'} = {}) {
  let clicksAdicionar = 0;
  const observers = [];
  class Input {
    constructor() { this.tagName = 'INPUT'; this.events = []; this.saved = ''; }
    set value(value) { this.saved = value; }
    get value() { return this.saved; }
    dispatchEvent(event) { this.events.push(event.type); }
  }
  function criarCard(numero) {
    const inputs = [new Input(), new Input()];
    const projeto = {textContent: 'Projeto livre', click() { throw Error('Nao selecionar projeto'); }};
    const label = {textContent: 'Projeto *', parentElement: {querySelector: () => projeto}};
    const card = {querySelectorAll: selector => selector === 'label' ? [label] : inputs};
    const badge = {className: 'rounded-full', textContent: String(numero), closest: () => card};
    return {inputs, projeto, badge};
  }
  const periodos = Array.from({length: total}, (_, i) => criarCard(i + 1));
  const adicionar = {textContent: 'Adicionar Período', click() { clicksAdicionar++; periodos.push(criarCard(2)); }};
  const salvar = {textContent: 'Salvar OS', click() { throw Error('NAO SALVAR OS'); }};
  const document = {
    body: {}, addEventListener() {},
    querySelectorAll(selector) {
      if (selector === 'div') return periodos.map(p => p.badge);
      if (selector === 'button') return [salvar, adicionar];
      if (selector === 'label') throw Error('Nao selecionar cliente');
      return [];
    }
  };
  const context = vm.createContext({document, window: {}, location: {hostname, pathname: '/work-orders'},
    HTMLInputElement: Input, HTMLTextAreaElement: Input,
    Event: class {constructor(type) {this.type = type;}},
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = true; observers.push(this); }
      observe() {} disconnect() { this.active = false; }
    },
    setTimeout(callback) { return setTimeout(callback, 0); }, clearTimeout
  });
  vm.runInContext(source, context);
  return {executar: context.preencherOrdemServico, periodos, observers,
    get clicksAdicionar() {return clicksAdicionar;},
    mutate() { observers.filter(o => o.active).forEach(o => o.callback()); }
  };
}

test('cria dois periodos sem selecionar cliente/projeto nem salvar OS', async () => {
  const tela = criarTela();
  assert.equal((await tela.executar({jornada:'9'})).ok, true);
  assert.equal(tela.periodos.length, 2);
  assert.deepEqual(tela.periodos.map(p => p.inputs.map(i => i.value)), [['08:00','12:00'],['13:00','18:00']]);
  await tela.executar({jornada:'8'});
  assert.equal(tela.clicksAdicionar, 1);
  assert.equal(tela.periodos[1].inputs[1].value, '17:00');
  assert.equal(tela.observers.filter(o => o.active).length, 1);
});

test('reaplica horarios apos troca de projeto e reset tardio em cada periodo', async () => {
  const tela = criarTela({total:2});
  await tela.executar({jornada:'8'});
  for (const p of tela.periodos) {
    p.projeto.textContent = 'Outro projeto';
    p.inputs.forEach(i => {i.value = '';});
    tela.mutate(); await wait();
  }
  assert.deepEqual(tela.periodos.map(p => p.inputs.map(i => i.value)), [['08:00','12:00'],['13:00','17:00']]);
  tela.periodos[1].inputs.forEach(i => {i.value = '';});
  tela.mutate(); await wait();
  assert.equal(tela.periodos[1].inputs[0].value,'13:00');
});

test('preserva horarios manuais preenchidos em mutacoes sem troca de projeto', async () => {
  const tela = criarTela({total:3});
  tela.periodos[2].inputs[0].value = '19:00';
  await tela.executar({jornada:'9'});
  tela.periodos[0].inputs[0].value = '09:00';
  tela.mutate(); await wait();
  assert.equal(tela.periodos[0].inputs[0].value, '09:00');
  assert.equal(tela.periodos[2].inputs[0].value, '19:00');
});

test('recria segundo periodo se mudanca de cliente reinicializar os cards', async () => {
  const tela = criarTela();
  await tela.executar({jornada:'9'});
  tela.periodos.pop();
  tela.periodos[0].inputs.forEach(i => {i.value = '';});
  tela.mutate(); await wait();
  assert.equal(tela.periodos.length, 2);
  assert.equal(tela.periodos[1].inputs[1].value, '18:00');
});

test('nao age fora do portal ou sem formulario de periodos', async () => {
  const fora = criarTela({hostname:'outro.example'});
  assert.equal((await fora.executar({})).encontrouTela, false);
  assert.equal(fora.clicksAdicionar, 0);
  const semTela = criarTela({total:0});
  assert.equal((await semTela.executar({})).encontrouTela, false);
  assert.equal(semTela.clicksAdicionar, 0);
});

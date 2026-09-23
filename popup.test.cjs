const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(`${__dirname}/popup.js`, 'utf8');

function criarTela() {
  let opcoes = [];
  const projetosSelecionados = [];

  class Input {
    constructor() { this.tagName = 'INPUT'; this.events = []; }
    set value(valor) { this.saved = valor; }
    get value() { return this.saved; }
    dispatchEvent(evento) { this.events.push(evento.type); }
  }

  const trigger = texto => ({
    click() {
      opcoes = [{
        textContent: texto,
        click() { projetosSelecionados.push(texto); opcoes = []; }
      }];
    }
  });
  const clienteTrigger = trigger('DGB INTERNO');

  const criarCard = numero => {
    const inputs = [new Input(), new Input()];
    const projetoTrigger = trigger('DEMANDAS INTERNAS');
    const label = { textContent: 'Projeto', parentElement: { querySelector: () => projetoTrigger } };
    const card = {
      querySelectorAll(seletor) { return seletor === 'label' ? [label] : inputs; }
    };
    const badge = {
      className: 'rounded-full badge',
      textContent: String(numero),
      closest() { return card; }
    };
    return { badge, inputs };
  };

  const periodos = [criarCard(1)];
  const clienteLabel = { textContent: 'Cliente', parentElement: { querySelector: () => clienteTrigger } };
  const adicionar = { textContent: 'Adicionar Período', click() { periodos.push(criarCard(2)); } };
  const document = {
    addEventListener() {},
    querySelectorAll(seletor) {
      if (seletor === 'label') return [clienteLabel];
      if (seletor === 'div') return periodos.map(item => item.badge);
      if (seletor === '[role="option"]') return opcoes;
      if (seletor === 'button') return [adicionar];
      return [];
    }
  };

  const context = vm.createContext({
    document,
    HTMLInputElement: Input,
    HTMLTextAreaElement: Input,
    Event: class { constructor(type) { this.type = type; } },
    setTimeout(callback) { callback(); }
  });
  vm.runInContext(source, context);
  return { executar: context.preencherOrdemServico, periodos, projetosSelecionados };
}

test('preenche dois períodos na jornada padrão de 9 horas', async () => {
  const tela = criarTela();
  const resultado = await tela.executar({
    cliente: 'DGB INTERNO', projeto: 'DEMANDAS INTERNAS', jornada: '9', intervalo: 500
  });
  assert.equal(resultado.ok, true);
  assert.equal(tela.periodos.length, 2);
  assert.deepEqual(tela.periodos[0].inputs.map(item => item.value), ['08:00', '12:00']);
  assert.deepEqual(tela.periodos[1].inputs.map(item => item.value), ['13:00', '18:00']);
});

test('encerra às 17:00 quando a jornada é de 8 horas', async () => {
  const tela = criarTela();
  const resultado = await tela.executar({
    cliente: 'DGB INTERNO', projeto: 'DEMANDAS INTERNAS', jornada: '8', intervalo: 100
  });
  assert.equal(resultado.ok, true);
  assert.equal(tela.periodos[1].inputs[1].value, '17:00');
});

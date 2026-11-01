# OS Veloz

Extensão de navegador (Manifest V3) para criar dois períodos e preencher seus horários no cadastro de OS do [Portal Consultor](https://portalconsultor.dgbtecnologia.com.br/work-orders), independentemente do cliente ou projeto escolhido.

## Instalação e atualização

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o **Modo do desenvolvedor** e use **Carregar sem compactação** para selecionar esta pasta.
3. Se já estiver instalada, clique em **Recarregar** na extensão. Recarregue também a página do portal para remover uma execução antiga.

Não há build nem dependências de pacote.

## Uso

1. Abra o cadastro da OS no portal e escolha o cliente desejado.
2. Abra a extensão e escolha a jornada: **9 horas** (`08:00–12:00` e `13:00–18:00`) ou **8 horas** (`08:00–12:00` e `13:00–17:00`).
3. Clique em **Preencher períodos**. O segundo período é adicionado se necessário; os horários dos períodos 1 e 2 são preenchidos.
4. Escolha ou troque o projeto de cada período normalmente. A extensão reaplica os horários após o reset do portal. Não é necessário manter o popup aberto.
5. Preencha tarefas e descrições e confira os dados. A extensão não salva OS; concluir o cadastro é uma ação manual no portal.

Cliente e projeto não são selecionados pela extensão. As configurações antigas desses campos são ignoradas. **Salvar configuração** guarda apenas jornada e intervalo em `chrome.storage.local`, sem alterar o portal. **Preencher períodos** também guarda essas preferências.

O intervalo (50 a 10000 ms, padrão 500) controla a espera entre atualizações. Após trocar um projeto, aguarde esse intervalo para os horários reaparecerem.

Se a mudança de cliente recriar apenas o primeiro período, a extensão adiciona o segundo novamente. Períodos adicionais são preservados. Horários manuais não vazios são preservados quando não há troca de projeto; campos vazios são recompostos automaticamente. Uma nova execução de **Preencher períodos** aplica novamente todos os horários da jornada selecionada.

O acompanhamento dura na página atual até ela ser recarregada. Depois de recarregar, ative **Preencher períodos** novamente. Consulte [funcionamento e validação](docs/funcionamento.md).

## Testes

```bash
node popup.test.cjs
```

## Licença

Este repositório não inclui um arquivo de licença. A definição dos termos de uso requer revisão do responsável pelo projeto.

# Preenchimento dos períodos — versão 1.1.0

## Escopo

A extensão atua somente no caminho `/work-orders` de `portalconsultor.dgbtecnologia.com.br`. Não depende dos nomes de clientes e projetos, não abre suas listas e não escolhe opções. O único botão do portal acionado pelo código é **Adicionar Período**. Não há chamada a API nem clique em Salvar OS.

## Fluxo

O popup persiste jornada e intervalo e injeta `preencherOrdemServico` no frame com o formulário. O script identifica os cartões numerados 1 e 2, cria o segundo se necessário e preenche os inputs de horário com o setter nativo e eventos input/change, compatíveis com os campos controlados pelo portal.

Um MutationObserver acompanha a página após fechar o popup. Alterações no texto do projeto, substituição do cartão e resets de campos vazios provocam o preenchimento após o intervalo configurado. A escrita só ocorre quando o valor difere do esperado, evitando ciclos do próprio observer. Outros campos e períodos acima de 2 não são alterados.

Uma nova execução desconecta o observer anterior antes de instalar outro. Recarregar a página encerra o acompanhamento. Ao mudar a jornada no popup, execute Preencher períodos para aplicá-la à página.

## Validação em 31/10/2026

- Inspeção do cadastro real: estrutura dos cartões e inputs confirmada; troca de projeto reproduziu o reset de ambos os horários. Troca de cliente recriou apenas um período.
- Cinco testes locais do script: jornadas 8/9, criação do segundo período sem seleção de cliente/projeto, troca de projeto e reset tardio, reexecução sem duplicação de cartões/observers, preservação de horários manuais e terceiro período, reconstrução após troca de cliente e recusa fora da tela/domínio.
- O teste lança erro se o script tentar clicar em Salvar OS ou selecionar cliente/projeto.
- A injeção da extensão atualizada não foi executada no portal pelo agente; a lógica foi validada no simulador. Nenhuma OS foi salva nos testes. Credenciais não fazem parte do código ou da documentação.

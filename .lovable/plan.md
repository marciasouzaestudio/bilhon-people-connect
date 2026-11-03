# Liberar o login sem e-mail de confirmação

O e-mail de confirmação não chegou, então você ficou travada no cadastro. Vou fazer o seguinte:

1. Ligar a confirmação automática de conta. Assim, quem se cadastra já entra direto, sem esperar e-mail.
2. Confirmar a conta que você já criou, para você conseguir entrar com o e-mail e a senha que cadastrou.
3. Testar o login de ponta a ponta e confirmar que você chega à tela de configuração inicial.

## Observação
Com isso ligado, o cadastro não confere se o e-mail existe de verdade. Se depois quiser voltar a exigir confirmação, é só configurar um domínio de envio de e-mails e eu desligo a confirmação automática.

## Detalhes técnicos
- Ativar auto-confirm na autenticação do Cloud.
- Marcar o usuário já cadastrado como confirmado.
- Não muda nenhum código do app.

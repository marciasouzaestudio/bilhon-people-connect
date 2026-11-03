# bilhon-motion — MaquinaCli (efeito-assinatura Bilhon)

GERADO por apply-bilhon-ds (make-motion-layer). Camada DROP-IN reversível.
O "terminal CLI animado" da Bilhon: 5 peças + orquestrador central + 3 terminais
que digitam sozinhos, com a luz correndo nas trilhas (bilhon-light-run).

## ⚠️ É um componente REACT
Requer o app ser **React / Next.js** (o arquivo tem `"use client"` e usa hooks +
`IntersectionObserver`). Não há versão vanilla — se o destino não for React/Next,
esta camada NÃO se aplica.

## Wiring (1 linha — montar DENTRO de `.bos-scope`)
```tsx
import { MaquinaCli } from "./bilhon-motion/MaquinaCli/MaquinaCli";
// ...dentro de um nó já envolto em .bos-scope (onde os --bl-* resolvem):
<div className="bos-scope"><MaquinaCli /></div>
```
Props: `<MaquinaCli autoStart loops={3} className="" />` (auto-start ao entrar
no viewport; `loops` = voltas do loop I2→I6 antes de pausar).

## Dependências
- **motion** (pacote `motion`, expõe `motion/react`) — usado por
  `useReducedMotion()`.  Instale: `npm i motion`.
- **CSS Modules** habilitado (importa `maquina-cli.module.css`). Next/Vite já têm.
- **Ícones**: `icons.ts` aponta para `/maquina/*.svg` (assets em `public/`).
  Copie os SVGs de `bilhon-os/public/maquina/` para o `public/maquina/` do destino,
  **ou** troque por ícones **lucide-react** tratados no accent (`color: var(--bl-accent)`)
  — `icons.ts` é editável justamente p/ isso.

## Customização
- `content.ts` = copy dos 6 terminais (texto livre). `icons.ts` = 5 peças + hero.
- NÃO edite `useMaquinaEngine.ts` nem `maquina-cli.module.css` (motor + assinatura).

## Reverter
Remova a import do `MaquinaCli` e a pasta `bilhon-motion/`. Sem efeitos colaterais.

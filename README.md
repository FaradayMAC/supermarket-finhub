# Supermercado Flow

Sistema Financeiro para Rede de Supermercados

Desenvolva um sistema web responsivo para gestão financeira de uma rede de supermercados com múltiplas unidades.

Objetivo

Permitir controle detalhado de despesas, custos operacionais, custos de funcionários, impostos, CMV e resultado financeiro por loja, consolidando todas as informações em dashboards gerenciais.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/124b908f-3aa0-4347-a60a-cc939ac7e7a3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Cálculo do IRRF (Imposto de Renda na Fonte) — Lei 15.270/2025

O cálculo do IRRF mensal está implementado em `src/lib/contracheque.ts`
(`calcIrrf` e `redutorIrrf2026`), vigente desde janeiro de 2026. A lógica é:

### 1. Base de cálculo

```
base = max(0, baseBruta - INSS - dependentes × R$ 189,59)
```

Cada dependente abate R$ 189,59 da base; o INSS é deduzido antes da tabela.

### 2. Tabela progressiva mensal (Lei 15.191/2025)

| Até (R$)        | Alíquota | Parcela a deduzir |
|-----------------|----------|-------------------|
| 2.428,80        | isenta   | 0,00              |
| 2.826,65        | 7,5%     | 182,16            |
| 3.751,05        | 15%      | 394,16            |
| 4.664,68        | 22,5%    | 675,49            |
| acima           | 27,5%    | 908,73            |

`irrfTabela = max(0, base × alíquota − parcela a deduzir)`

### 3. Redutor mensal (Lei 15.270/2025 — Tabela de Redução Mensal RFB)

Aplicado sobre o rendimento tributável (por padrão, a própria `baseBruta`):

- **Até R$ 5.000,00 → isenção PLENA.** O redutor cancela integralmente o
  `irrfTabela`, deixando o imposto líquido em **zero** — com ou sem
  dependentes. Isso garante que salários de R$ 4.500 ou R$ 5.000 fiquem
  isentos mesmo quando a tabela apontaria alíquota de 15% ou 22,5%.
- **R$ 5.000,01 a R$ 7.350,00 → redução DECRESCENTE linear:**
  `redutor = max(0, 978,62 − 0,133145 × rendimento)`. O redutor diminui à
  medida que a renda sobe e zera em R$ 7.350,00.
- **Acima de R$ 7.350,00 → sem redutor** (0); paga-se a tabela progressiva cheia.

### 4. Resultado

```
líquido = round(max(0, irrfTabela − redutor))
```

### Detalhe de implementação

Na faixa de isenção plena (até R$ 5.000,00) o `calcIrrf` iguala o redutor ao
próprio `irrfTabela` calculado, em vez de usar o valor fixo R$ 312,89 da
tabela RFB. Esse valor fixo só é relevante no trecho de redução decrescente
(R$ 5.000,01 a R$ 7.350,00); usá-lo na faixa de isenção deixaria um imposto
residual (~R$ 23,78 em R$ 5.000) e não cumprira a isenção integral da lei.

Os casos de teste que validam essa lógica — incluindo as fronteiras de cada
faixa até R$ 5.000,00 — estão em `src/lib/contracheque.test.ts` (bloco
"redutor do IRRF — Lei 15.270/2025"). Rode `npm test` para executá-los.

# Supportech — Arquitetura do sistema

## Objetivo

O Supportech será uma central de suporte de TI com duas experiências sobre o mesmo domínio: o portal do solicitante e a central operacional da equipe de TI.

## Módulos

- Visão geral: indicadores operacionais e saúde do atendimento.
- Chamados: abertura, triagem, atribuição, atendimento, resolução e fechamento.
- Ativos: inventário e vínculo entre equipamento, usuário, setor e chamados.
- Usuários: solicitantes, técnicos, gestores e administradores.
- Base de conhecimento: procedimentos e soluções reutilizáveis.
- Relatórios: indicadores de atendimento, SLA e desempenho.
- Catálogo de serviços: solicitações orientadas por serviço e categoria.
- Configurações: parâmetros, permissões e administração.

## Domínio de chamados

O ciclo previsto é:

`NOVO → ATRIBUÍDO → EM ATENDIMENTO → AGUARDANDO USUÁRIO → RESOLVIDO → FECHADO`

Um chamado pode ser reaberto quando a solução não resolver a solicitação. Status, prioridade e permissões devem ser validados no backend quando a persistência for implementada.

### Relações principais

```text
Usuário ──< Chamado >── Técnico
             │
             ├── Categoria
             ├── Serviço
             ├── Setor
             └── Ativo
```

## Perfis

- **Solicitante:** abre e acompanha seus chamados.
- **Técnico:** atende chamados atribuídos ou disponíveis conforme permissão.
- **Gestor:** acompanha sua equipe/setor e indicadores autorizados.
- **Administrador:** administra usuários, catálogo, parâmetros e permissões.

## Navegação

A App Shell é persistente no desktop: sidebar fixa e área de conteúdo troca conforme a rota. No mobile, a sidebar se transforma em drawer.

## Princípios

1. UI consistente e acessível.
2. Regras de negócio não ficam apenas no frontend.
3. Componentes reutilizáveis antes de duplicação.
4. Dados reais substituirão os dados demonstrativos sem alterar a estrutura visual do dashboard.
5. Segurança e autorização serão tratadas no servidor na fase de persistência/autenticação.
6. O Lovable é apenas preview; o GitHub é a fonte oficial do código.

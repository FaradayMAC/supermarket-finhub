export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cargos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          motivo_insalubridade: Database["public"]["Enums"]["motivo_insalubridade"]
          nome: string
          periculosidade_pct: number
          salario_base: number
          tem_periculosidade: boolean
          tem_quebra_caixa: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          motivo_insalubridade?: Database["public"]["Enums"]["motivo_insalubridade"]
          nome: string
          periculosidade_pct?: number
          salario_base?: number
          tem_periculosidade?: boolean
          tem_quebra_caixa?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          motivo_insalubridade?: Database["public"]["Enums"]["motivo_insalubridade"]
          nome?: string
          periculosidade_pct?: number
          salario_base?: number
          tem_periculosidade?: boolean
          tem_quebra_caixa?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      categorias_despesa: {
        Row: {
          categoria_pai_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          categoria_pai_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          categoria_pai_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_despesa_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          loja_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centros_custo_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_mercadoria: {
        Row: {
          created_at: string
          created_by: string | null
          data_compra: string
          data_pagamento: string | null
          empresa_id: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string
          numero_nf: string | null
          observacoes: string | null
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_compra: string
          data_pagamento?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_compra?: string
          data_pagamento?: string | null
          empresa_id?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_mercadoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_mercadoria_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_mercadoria_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_mercadoria_itens: {
        Row: {
          compra_id: string
          created_at: string
          descricao: string | null
          id: string
          produto_id: string | null
          quantidade: number
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          compra_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          compra_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          produto_id?: string | null
          quantidade?: number
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_mercadoria_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras_mercadoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_mercadoria_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          updated_at: string
          valor: number
        }
        Insert: {
          chave: string
          created_at?: string
          updated_at?: string
          valor: number
        }
        Update: {
          chave?: string
          created_at?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      convenio_funcionario: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          loja_id: string
          mes_referencia: string
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          loja_id: string
          mes_referencia: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          loja_id?: string
          mes_referencia?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenio_funcionario_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_funcionario_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria_id: string | null
          centro_custo: string | null
          centro_custo_id: string | null
          created_at: string
          data_competencia: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          empresa_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string
          observacoes: string | null
          status: string
          titulo_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_competencia: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id: string
          observacoes?: string | null
          status?: string
          titulo_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          created_at?: string
          data_competencia?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string
          observacoes?: string | null
          status?: string
          titulo_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_titulo_id_fkey"
            columns: ["titulo_id"]
            isOneToOne: false
            referencedRelation: "titulos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          razao_social: string
          regime_tributario: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social: string
          regime_tributario?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          regime_tributario?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      extratos_bancarios: {
        Row: {
          conciliado: boolean
          conta: string
          created_at: string
          data: string
          descricao: string
          empresa_id: string | null
          id: string
          loja_id: string | null
          observacoes: string | null
          tipo: string
          titulo_financeiro_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          conciliado?: boolean
          conta: string
          created_at?: string
          data: string
          descricao: string
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          tipo: string
          titulo_financeiro_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          conciliado?: boolean
          conta?: string
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          tipo?: string
          titulo_financeiro_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_titulo_financeiro_id_fkey"
            columns: ["titulo_financeiro_id"]
            isOneToOne: false
            referencedRelation: "titulos_financeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas_rh: {
        Row: {
          created_at: string
          data: string
          funcionario_id: string
          id: string
          loja_id: string
          motivo: string | null
          observacoes: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          funcionario_id: string
          id?: string
          loja_id: string
          motivo?: string | null
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          loja_id?: string
          motivo?: string | null
          observacoes?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faltas_rh_funcionario_id_fkey1"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_rh_loja_id_fkey1"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      faltas_rh_legado: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          loja_id: string
          mes_referencia: string
          observacoes: string | null
          quantidade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          loja_id: string
          mes_referencia: string
          observacoes?: string | null
          quantidade: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          loja_id?: string
          mes_referencia?: string
          observacoes?: string | null
          quantidade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faltas_rh_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faltas_rh_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias_gozadas: {
        Row: {
          created_at: string
          data_inicio_gozo: string
          dias_gozados: number
          funcionario_id: string
          id: string
          observacoes: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_inicio_gozo: string
          dias_gozados?: number
          funcionario_id: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_inicio_gozo?: string
          dias_gozados?: number
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ferias_gozadas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fgts_saques: {
        Row: {
          created_at: string
          data: string
          funcionario_id: string
          id: string
          motivo: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fgts_saques_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      folha_pagamento: {
        Row: {
          beneficios: number
          comissoes: number
          competencia: string
          created_at: string
          custo_total: number
          data_pagamento: string | null
          empresa_id: string | null
          fechada_em: string | null
          fechada_por: string | null
          fgts: number
          funcionario_id: string
          horas_extras: number
          id: string
          inss: number
          irrf: number
          liquido: number
          loja_id: string | null
          outros_descontos: number
          outros_encargos: number
          salario_base: number
          status: string
          total_descontos: number
          total_proventos: number
          updated_at: string
        }
        Insert: {
          beneficios?: number
          comissoes?: number
          competencia: string
          created_at?: string
          custo_total?: number
          data_pagamento?: string | null
          empresa_id?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          fgts?: number
          funcionario_id: string
          horas_extras?: number
          id?: string
          inss?: number
          irrf?: number
          liquido?: number
          loja_id?: string | null
          outros_descontos?: number
          outros_encargos?: number
          salario_base?: number
          status?: string
          total_descontos?: number
          total_proventos?: number
          updated_at?: string
        }
        Update: {
          beneficios?: number
          comissoes?: number
          competencia?: string
          created_at?: string
          custo_total?: number
          data_pagamento?: string | null
          empresa_id?: string | null
          fechada_em?: string | null
          fechada_por?: string | null
          fgts?: number
          funcionario_id?: string
          horas_extras?: number
          id?: string
          inss?: number
          irrf?: number
          liquido?: number
          loja_id?: string | null
          outros_descontos?: number
          outros_encargos?: number
          salario_base?: number
          status?: string
          total_descontos?: number
          total_proventos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folha_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folha_pagamento_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          categoria: string
          cnpj: string | null
          condicao_pagamento_padrao: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          cnpj?: string | null
          condicao_pagamento_padrao?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cnpj?: string | null
          condicao_pagamento_padrao?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          beneficios: number
          calcula_encargos: boolean
          cargo: string | null
          cargo_id: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          dependentes: number
          desconto_vt: boolean
          email: string | null
          empresa_id: string | null
          fgts_saldo_inicial: number
          fgts_saldo_inicial_data: string | null
          id: string
          loja_id: string
          motivo_insalubridade: Database["public"]["Enums"]["motivo_insalubridade"]
          nome: string
          observacoes: string | null
          periculosidade_pct: number
          plano_odontologico: number
          plano_saude: number
          prestador_id: string | null
          salario_base: number
          salario_familia: number
          situacao: string | null
          telefone: string | null
          tem_periculosidade: boolean
          tem_quebra_caixa: boolean
          updated_at: string
          vale_alimentacao: number
          vale_transporte: number
          valor_extra_salarial: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: number
          calcula_encargos?: boolean
          cargo?: string | null
          cargo_id?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          dependentes?: number
          desconto_vt?: boolean
          email?: string | null
          empresa_id?: string | null
          fgts_saldo_inicial?: number
          fgts_saldo_inicial_data?: string | null
          id?: string
          loja_id: string
          motivo_insalubridade?: Database["public"]["Enums"]["motivo_insalubridade"]
          nome: string
          observacoes?: string | null
          periculosidade_pct?: number
          plano_odontologico?: number
          plano_saude?: number
          prestador_id?: string | null
          salario_base?: number
          salario_familia?: number
          situacao?: string | null
          telefone?: string | null
          tem_periculosidade?: boolean
          tem_quebra_caixa?: boolean
          updated_at?: string
          vale_alimentacao?: number
          vale_transporte?: number
          valor_extra_salarial?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: number
          calcula_encargos?: boolean
          cargo?: string | null
          cargo_id?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          dependentes?: number
          desconto_vt?: boolean
          email?: string | null
          empresa_id?: string | null
          fgts_saldo_inicial?: number
          fgts_saldo_inicial_data?: string | null
          id?: string
          loja_id?: string
          motivo_insalubridade?: Database["public"]["Enums"]["motivo_insalubridade"]
          nome?: string
          observacoes?: string | null
          periculosidade_pct?: number
          plano_odontologico?: number
          plano_saude?: number
          prestador_id?: string | null
          salario_base?: number
          salario_familia?: number
          situacao?: string | null
          telefone?: string | null
          tem_periculosidade?: boolean
          tem_quebra_caixa?: boolean
          updated_at?: string
          vale_alimentacao?: number
          vale_transporte?: number
          valor_extra_salarial?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "vw_prestador_funcionarios"
            referencedColumns: ["prestador_id"]
          },
        ]
      }
      impostos: {
        Row: {
          aliquota: number
          base_calculo: number
          competencia: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          loja_id: string | null
          observacoes: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          aliquota?: number
          base_calculo?: number
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          aliquota?: number
          base_calculo?: number
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "impostos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impostos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          codigo: string
          created_at: string
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          gerente: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          codigo: string
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          gerente?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          codigo?: string
          created_at?: string
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          gerente?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          categoria_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          loja_id: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          tipo: string
          updated_at: string
          valor_meta: number
          valor_realizado: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          tipo: string
          updated_at?: string
          valor_meta?: number
          valor_realizado?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          loja_id?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          tipo?: string
          updated_at?: string
          valor_meta?: number
          valor_realizado?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          conta: string | null
          created_at: string
          data_movimentacao: string
          descricao: string
          empresa_id: string | null
          forma_pagamento: string | null
          id: string
          loja_id: string | null
          observacoes: string | null
          origem: string | null
          origem_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta?: string | null
          created_at?: string
          data_movimentacao: string
          descricao: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          conta?: string | null
          created_at?: string
          data_movimentacao?: string
          descricao?: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          origem?: string | null
          origem_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      perdas_estoque: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string | null
          id: string
          loja_id: string
          motivo: string
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          loja_id: string
          motivo?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          id?: string
          loja_id?: string
          motivo?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "perdas_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perdas_estoque_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      prestador_das_mensal: {
        Row: {
          competencia: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          id: string
          observacoes: string | null
          prestador_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          prestador_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          prestador_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestador_das_mensal_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_das_mensal_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "vw_prestador_funcionarios"
            referencedColumns: ["prestador_id"]
          },
        ]
      }
      prestador_das_rateio: {
        Row: {
          competencia: string
          created_at: string
          das_id: string
          folha_total: number
          folha_unidade: number
          id: string
          loja_id: string
          percentual: number
          prestador_id: string
          updated_at: string
          valor_das: number
          valor_rateado: number
        }
        Insert: {
          competencia: string
          created_at?: string
          das_id: string
          folha_total?: number
          folha_unidade?: number
          id?: string
          loja_id: string
          percentual?: number
          prestador_id: string
          updated_at?: string
          valor_das?: number
          valor_rateado?: number
        }
        Update: {
          competencia?: string
          created_at?: string
          das_id?: string
          folha_total?: number
          folha_unidade?: number
          id?: string
          loja_id?: string
          percentual?: number
          prestador_id?: string
          updated_at?: string
          valor_das?: number
          valor_rateado?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestador_das_rateio_das_id_fkey"
            columns: ["das_id"]
            isOneToOne: false
            referencedRelation: "prestador_das_mensal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_das_rateio_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_das_rateio_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_das_rateio_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "vw_prestador_funcionarios"
            referencedColumns: ["prestador_id"]
          },
        ]
      }
      prestadores_servico: {
        Row: {
          aliquota_das: number
          anexo_simples: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          regime_tributario: string
          responsavel: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          aliquota_das?: number
          anexo_simples?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          regime_tributario?: string
          responsavel?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_das?: number
          anexo_simples?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          regime_tributario?: string
          responsavel?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_produto: string | null
          created_at: string
          id: string
          nome: string
          sku: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_produto?: string | null
          created_at?: string
          id?: string
          nome: string
          sku?: string | null
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_produto?: string | null
          created_at?: string
          id?: string
          nome?: string
          sku?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          email: string | null
          id: string
          loja_id: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id: string
          loja_id?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      titulos_financeiros: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_ref: string | null
          created_at: string
          data_emissao: string
          data_pagamento_efetivo: string | null
          data_pagamento_previsto: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string | null
          numero_documento: string | null
          numero_parcela: number
          observacoes: string | null
          origem: string
          origem_id: string | null
          status: string
          tipo: string
          total_parcelas: number
          updated_at: string
          valor: number
          valor_pago: number
        }
        Insert: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_ref?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento_efetivo?: string | null
          data_pagamento_previsto?: string | null
          data_vencimento?: string
          descricao: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          numero_documento?: string | null
          numero_parcela?: number
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          status?: string
          tipo: string
          total_parcelas?: number
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Update: {
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_ref?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento_efetivo?: string | null
          data_pagamento_previsto?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_id?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          numero_documento?: string | null
          numero_parcela?: number
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          status?: string
          tipo?: string
          total_parcelas?: number
          updated_at?: string
          valor?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "titulos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_despesa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titulos_financeiros_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titulos_financeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titulos_financeiros_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "titulos_financeiros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          perfil: string
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id?: string
          nome: string
          perfil?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          perfil?: string
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas_diarias: {
        Row: {
          conferido_caixa: boolean
          created_at: string
          created_by: string | null
          data: string
          empresa_id: string | null
          fonte: string
          id: string
          loja_id: string
          observacoes: string | null
          qtd_cupons: number
          updated_at: string
          valor_cartao_credito: number
          valor_cartao_debito: number
          valor_dinheiro: number
          valor_outros: number
          valor_pix: number
          valor_total: number | null
        }
        Insert: {
          conferido_caixa?: boolean
          created_at?: string
          created_by?: string | null
          data: string
          empresa_id?: string | null
          fonte?: string
          id?: string
          loja_id: string
          observacoes?: string | null
          qtd_cupons?: number
          updated_at?: string
          valor_cartao_credito?: number
          valor_cartao_debito?: number
          valor_dinheiro?: number
          valor_outros?: number
          valor_pix?: number
          valor_total?: number | null
        }
        Update: {
          conferido_caixa?: boolean
          created_at?: string
          created_by?: string | null
          data?: string
          empresa_id?: string | null
          fonte?: string
          id?: string
          loja_id?: string
          observacoes?: string | null
          qtd_cupons?: number
          updated_at?: string
          valor_cartao_credito?: number
          valor_cartao_debito?: number
          valor_dinheiro?: number
          valor_outros?: number
          valor_pix?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_diarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_diarias_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_prestador_funcionarios: {
        Row: {
          aliquota_das: number | null
          anexo_simples: string | null
          funcionarios_ativos: number | null
          nome_fantasia: string | null
          prestador_id: string | null
          razao_social: string | null
          regime_tributario: string | null
          salario_bruto_ativos: number | null
          status: string | null
          total_funcionarios: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_edit_all: { Args: never; Returns: boolean }
      can_view_all: { Args: never; Returns: boolean }
      current_user_loja: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_of: { Args: { _loja_id: string }; Returns: boolean }
      recalc_das_rateio: { Args: { _das_id: string }; Returns: undefined }
      recalc_das_rateio_prestador: {
        Args: { _prestador: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "diretoria" | "controladoria" | "gerente"
      motivo_insalubridade:
        | "nenhum"
        | "asg_limpeza_terceirizada"
        | "frio_camara_fria"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "diretoria", "controladoria", "gerente"],
      motivo_insalubridade: [
        "nenhum",
        "asg_limpeza_terceirizada",
        "frio_camara_fria",
      ],
    },
  },
} as const

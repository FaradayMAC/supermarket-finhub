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
          id: string
          loja_id: string
          observacoes: string | null
          status: string
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
          id?: string
          loja_id: string
          observacoes?: string | null
          status?: string
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
          id?: string
          loja_id?: string
          observacoes?: string | null
          status?: string
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
            foreignKeyName: "despesas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
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
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      funcionarios: {
        Row: {
          ativo: boolean
          beneficios: number
          cargo: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          dependentes: number
          email: string | null
          empresa_id: string | null
          encargos: number
          id: string
          loja_id: string
          nome: string
          plano_odontologico: number
          plano_saude: number
          prestador_id: string | null
          regime_tributario: string
          salario_base: number
          salario_familia: number
          telefone: string | null
          updated_at: string
          vale_alimentacao: number
          vale_transporte: number
          valor_extra_salarial: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: number
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          dependentes?: number
          email?: string | null
          empresa_id?: string | null
          encargos?: number
          id?: string
          loja_id: string
          nome: string
          plano_odontologico?: number
          plano_saude?: number
          prestador_id?: string | null
          regime_tributario?: string
          salario_base?: number
          salario_familia?: number
          telefone?: string | null
          updated_at?: string
          vale_alimentacao?: number
          vale_transporte?: number
          valor_extra_salarial?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: number
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          dependentes?: number
          email?: string | null
          empresa_id?: string | null
          encargos?: number
          id?: string
          loja_id?: string
          nome?: string
          plano_odontologico?: number
          plano_saude?: number
          prestador_id?: string | null
          regime_tributario?: string
          salario_base?: number
          salario_familia?: number
          telefone?: string | null
          updated_at?: string
          vale_alimentacao?: number
          vale_transporte?: number
          valor_extra_salarial?: number
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
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
    }
    Enums: {
      app_role: "admin" | "diretoria" | "controladoria" | "gerente"
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
    },
  },
} as const

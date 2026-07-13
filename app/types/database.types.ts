export type Database = {
  public: {
    Tables: {
      profesores: {
        Row: {
          id: string
          nombre: string
          email: string
          creado_en: string
        }
        Insert: {
          id: string
          nombre: string
          email: string
          creado_en?: string
        }
        Update: {
          id?: string
          nombre?: string
          email?: string
          creado_en?: string
        }
        Relationships: []
      }
      reglas_dificultad: {
        Row: {
          id: string
          profesor_id: string
          dificultad: Database['public']['Enums']['dificultad_subtema']
          duracion_sesiones: number
          creado_en: string
        }
        Insert: {
          id?: string
          profesor_id: string
          dificultad: Database['public']['Enums']['dificultad_subtema']
          duracion_sesiones: number
          creado_en?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          dificultad?: Database['public']['Enums']['dificultad_subtema']
          duracion_sesiones?: number
          creado_en?: string
        }
        Relationships: []
      }
      asignaturas: {
        Row: {
          id: string
          profesor_id: string
          nombre: string
          creado_en: string
        }
        Insert: {
          id?: string
          profesor_id: string
          nombre: string
          creado_en?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          nombre?: string
          creado_en?: string
        }
        Relationships: []
      }
      cursos: {
        Row: {
          id: string
          profesor_id: string
          nombre: string
          fecha_inicio: string
          fecha_fin: string
          creado_en: string
        }
        Insert: {
          id?: string
          profesor_id: string
          nombre: string
          fecha_inicio: string
          fecha_fin: string
          creado_en?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          nombre?: string
          fecha_inicio?: string
          fecha_fin?: string
          creado_en?: string
        }
        Relationships: []
      }
      dias_no_lectivos: {
        Row: {
          id: string
          curso_id: string
          nombre: string | null
          fecha_inicio: string
          fecha_fin: string
          creado_en: string
        }
        Insert: {
          id?: string
          curso_id: string
          nombre?: string | null
          fecha_inicio: string
          fecha_fin: string
          creado_en?: string
        }
        Update: {
          id?: string
          curso_id?: string
          nombre?: string | null
          fecha_inicio?: string
          fecha_fin?: string
          creado_en?: string
        }
        Relationships: []
      }
      temas: {
        Row: {
          id: string
          asignatura_id: string
          nombre: string
          orden: number
          creado_en: string
        }
        Insert: {
          id?: string
          asignatura_id: string
          nombre: string
          orden?: number
          creado_en?: string
        }
        Update: {
          id?: string
          asignatura_id?: string
          nombre?: string
          orden?: number
          creado_en?: string
        }
        Relationships: []
      }
      subtemas: {
        Row: {
          id: string
          tema_id: string
          nombre: string
          dificultad: Database['public']['Enums']['dificultad_subtema']
          orden: number
          creado_en: string
        }
        Insert: {
          id?: string
          tema_id: string
          nombre: string
          dificultad: Database['public']['Enums']['dificultad_subtema']
          orden?: number
          creado_en?: string
        }
        Update: {
          id?: string
          tema_id?: string
          nombre?: string
          dificultad?: Database['public']['Enums']['dificultad_subtema']
          orden?: number
          creado_en?: string
        }
        Relationships: []
      }
      grupos: {
        Row: {
          id: string
          profesor_id: string
          curso_id: string
          horario_tipo_id: string | null
          nombre: string
          color: string
          creado_en: string
        }
        Insert: {
          id?: string
          profesor_id: string
          curso_id: string
          horario_tipo_id?: string | null
          nombre: string
          color?: string
          creado_en?: string
        }
        Update: {
          id?: string
          profesor_id?: string
          curso_id?: string
          horario_tipo_id?: string | null
          nombre?: string
          color?: string
          creado_en?: string
        }
        Relationships: []
      }
      horarios_tipo: {
        Row: {
          id: string
          curso_id: string
          nombre: string
          creado_en: string
        }
        Insert: {
          id?: string
          curso_id: string
          nombre: string
          creado_en?: string
        }
        Update: {
          id?: string
          curso_id?: string
          nombre?: string
          creado_en?: string
        }
        Relationships: []
      }
      grupo_asignaturas: {
        Row: {
          id: string
          grupo_id: string
          asignatura_id: string
          creado_en: string
        }
        Insert: {
          id?: string
          grupo_id: string
          asignatura_id: string
          creado_en?: string
        }
        Update: {
          id?: string
          grupo_id?: string
          asignatura_id?: string
          creado_en?: string
        }
        Relationships: []
      }
      franjas_horarias: {
        Row: {
          id: string
          grupo_asignatura_id: string
          periodo_id: string
          dia_semana: Database['public']['Enums']['dia_semana']
          creado_en: string
        }
        Insert: {
          id?: string
          grupo_asignatura_id: string
          periodo_id: string
          dia_semana: Database['public']['Enums']['dia_semana']
          creado_en?: string
        }
        Update: {
          id?: string
          grupo_asignatura_id?: string
          periodo_id?: string
          dia_semana?: Database['public']['Enums']['dia_semana']
          creado_en?: string
        }
        Relationships: []
      }
      sesiones: {
        Row: {
          id: string
          franja_horaria_id: string
          fecha: string
          estado: Database['public']['Enums']['estado_sesion']
          creado_en: string
        }
        Insert: {
          id?: string
          franja_horaria_id: string
          fecha: string
          estado?: Database['public']['Enums']['estado_sesion']
          creado_en?: string
        }
        Update: {
          id?: string
          franja_horaria_id?: string
          fecha?: string
          estado?: Database['public']['Enums']['estado_sesion']
          creado_en?: string
        }
        Relationships: []
      }
      sesion_subtemas: {
        Row: {
          id: string
          sesion_id: string
          subtema_id: string
          fraccion: number
          creado_en: string
        }
        Insert: {
          id?: string
          sesion_id: string
          subtema_id: string
          fraccion?: number
          creado_en?: string
        }
        Update: {
          id?: string
          sesion_id?: string
          subtema_id?: string
          fraccion?: number
          creado_en?: string
        }
        Relationships: []
      }
      periodos_horarios: {
        Row: {
          id: string
          horario_tipo_id: string
          hora_inicio: string
          hora_fin: string
          orden: number
          creado_en: string
        }
        Insert: {
          id?: string
          horario_tipo_id: string
          hora_inicio: string
          hora_fin: string
          orden?: number
          creado_en?: string
        }
        Update: {
          id?: string
          horario_tipo_id?: string
          hora_inicio?: string
          hora_fin?: string
          orden?: number
          creado_en?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      dia_semana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'
      dificultad_subtema: 'baja' | 'media' | 'alta'
      estado_sesion: 'propuesta' | 'confirmada' | 'cancelada' | 'impartida'
    }
    CompositeTypes: Record<string, never>
  }
}

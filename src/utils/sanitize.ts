/**
 * Quita etiquetas HTML y recorta espacios. Se aplica a campos de texto
 * libre que el usuario captura (notas de paciente, razones) antes de
 * persistir, según la regla de seguridad mínima del proyecto.
 */
export function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

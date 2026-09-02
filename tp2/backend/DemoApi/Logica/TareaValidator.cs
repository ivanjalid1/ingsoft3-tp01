namespace DemoApi.Logica;

/// <summary>
/// Reglas de negocio para el alta de tareas. Lógica pura sin dependencias:
/// es lo que los unit tests del pipeline verifican (TP4/TP5).
/// </summary>
public static class TareaValidator
{
    public const int LargoMaximo = 100;

    public record Resultado(bool EsValida, string? Error, string? TituloNormalizado);

    public static Resultado Validar(string? titulo)
    {
        var normalizado = titulo?.Trim();

        if (string.IsNullOrEmpty(normalizado))
            return new Resultado(false, "El título es obligatorio.", null);

        if (normalizado.Length > LargoMaximo)
            return new Resultado(false, $"El título no puede superar los {LargoMaximo} caracteres.", null);

        return new Resultado(true, null, normalizado);
    }
}

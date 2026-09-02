using DemoApi.Logica;

namespace DemoApi.Tests;

public class TareaValidatorTests
{
    [Fact]
    public void TituloValido_EsAceptado_YSeNormalizaConTrim()
    {
        var resultado = TareaValidator.Validar("  Preparar la demo de la clase  ");

        Assert.True(resultado.EsValida);
        Assert.Null(resultado.Error);
        Assert.Equal("Preparar la demo de la clase", resultado.TituloNormalizado);
    }

    [Fact]
    public void TituloVacio_EsRechazado()
    {
        var resultado = TareaValidator.Validar("");

        Assert.False(resultado.EsValida);
        Assert.Equal("El título es obligatorio.", resultado.Error);
    }

    [Fact]
    public void TituloSoloEspacios_EsRechazado()
    {
        var resultado = TareaValidator.Validar("   ");

        Assert.False(resultado.EsValida);
        Assert.Equal("El título es obligatorio.", resultado.Error);
    }

    [Fact]
    public void TituloQueSuperaElLargoMaximo_EsRechazado()
    {
        var titulo = new string('a', TareaValidator.LargoMaximo + 1);

        var resultado = TareaValidator.Validar(titulo);

        Assert.False(resultado.EsValida);
        Assert.Contains($"{TareaValidator.LargoMaximo}", resultado.Error);
    }
}

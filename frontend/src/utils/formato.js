// Formateo de montos en pesos argentinos: $ 180.000,00
//
// Un solo helper para toda la app: cuando en la defensa pidan cambiar el
// formato (por ejemplo, sacar el simbolo o cambiar los decimales), este es
// el unico lugar que hay que tocar.
//
// Ojo con Intl + currency: 'ARS' inserta un espacio de ancho fijo (U+00A0,
// non-breaking space) entre el "$" y el numero, no un espacio comun
// (U+0020). Visualmente son identicos, pero un `getByText('$ 100,00')`
// escrito con espacio normal en un test NO matchea contra ese string y
// falla sin ninguna pista visible del porque. Lo normalizamos aca para que
// el resto de la app (pantallas y tests) trabaje siempre con espacio comun.
const formateador = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS'
});

export function formatearMonto(numero) {
  return formateador.format(numero).replace('\u00A0', ' ');
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import './BuscadorSelect.css';

/**
 * Select con buscador (combobox accesible).
 * value = id del item seleccionado (string o number).
 * items = [{ value, label }]
 */
export default function BuscadorSelect({
  items = [],
  value = '',
  onChange,
  placeholder = 'Buscar...',
  emptyLabel = 'Sin resultados',
  'aria-label': ariaLabel = 'Selector con buscador',
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [idxActivo, setIdxActivo] = useState(0);
  const raizRef = useRef(null);
  const inputRef = useRef(null);

  const seleccionado = useMemo(
    () => items.find((it) => String(it.value) === String(value)),
    [items, value]
  );

  useEffect(() => {
    if (!abierto) setTexto('');
  }, [abierto]);

  useEffect(() => {
    const alHacerClickFuera = (e) => {
      if (raizRef.current && !raizRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', alHacerClickFuera);
    document.addEventListener('touchstart', alHacerClickFuera);
    return () => {
      document.removeEventListener('mousedown', alHacerClickFuera);
      document.removeEventListener('touchstart', alHacerClickFuera);
    };
  }, []);

  const normalizar = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filtrados = useMemo(() => {
    const q = normalizar(texto).trim();
    if (!q) return items.slice(0, 50);
    return items.filter((it) => normalizar(it.label).includes(q)).slice(0, 50);
  }, [items, texto]);

  useEffect(() => {
    setIdxActivo(0);
  }, [texto]);

  const elegir = (item) => {
    onChange?.(item.value);
    setAbierto(false);
    setTexto('');
    inputRef.current?.focus();
  };

  const alTeclear = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAbierto(true);
      setIdxActivo((i) => Math.min(i + 1, Math.max(filtrados.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdxActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (abierto && filtrados[idxActivo]) {
        e.preventDefault();
        elegir(filtrados[idxActivo]);
      } else {
        setAbierto(true);
      }
    } else if (e.key === 'Escape') {
      setAbierto(false);
    }
  };

  const etiquetaVisible = abierto
    ? texto
    : seleccionado
      ? seleccionado.label
      : '';

  return (
    <div className="buscador-select" ref={raizRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        autoComplete="off"
        className="buscador-select-input"
        placeholder={seleccionado && !abierto ? seleccionado.label : placeholder}
        value={etiquetaVisible}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />
      {value !== '' && value != null && (
        <button
          type="button"
          className="buscador-select-limpiar"
          aria-label="Quitar selección"
          title="Quitar selección"
          onClick={() => {
            onChange?.('');
            setTexto('');
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      )}
      {abierto && (
        <ul className="buscador-select-lista" role="listbox">
          {filtrados.length === 0 ? (
            <li className="buscador-select-vacio">{emptyLabel}</li>
          ) : (
            filtrados.map((item, i) => (
              <li
                key={item.value}
                role="option"
                aria-selected={String(item.value) === String(value)}
                className={
                  'buscador-select-opcion' +
                  (i === idxActivo ? ' activa' : '') +
                  (String(item.value) === String(value) ? ' seleccionada' : '')
                }
                onMouseEnter={() => setIdxActivo(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(item);
                }}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

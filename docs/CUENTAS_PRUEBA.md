# Cuentas de prueba — Laboratorio de Topografía

Contraseña de **todas** las cuentas seed:

```text
LabTopo2026!
```


| Correo                           | Rol                      | Uso sugerido                          |
| -------------------------------- | ------------------------ | ------------------------------------- |
| `admin1@labtopo.uagro.edu.mx`    | Administrador            | Web (acceso total)                    |
| `admin2@labtopo.uagro.edu.mx`    | Administrador            | Web (segundo admin)                   |
| `encargado@labtopo.uagro.edu.mx` | Encargado de laboratorio | Web / móvil (inventario, solicitudes) |
| `maestro@labtopo.uagro.edu.mx`   | Maestro                  | Móvil (supervisión)                   |
| `alumno@labtopo.uagro.edu.mx`    | Alumno                   | Móvil / web (catálogo y préstamos)    |


## Particulares (renta a terceros)

No van en el seed. Se registran solos desde el login (**Registro para renta de equipo**).

1. Completan formulario (teléfono, empresa, INE, RFC, dirección).
2. Quedan en estado **pendiente**.
3. El **encargado** los aprueba en **Particulares** (web o móvil).
4. Ya aprobados, entran con correo/contraseña y solicitan con `loanType: rental`.

## Notas

- Se crean/actualizan con: `npm run seed:users`
- Si cambias la contraseña en Firebase Console, actualiza este archivo.
- **No subas contraseñas de producción** a este documento; solo son cuentas de desarrollo/prueba.


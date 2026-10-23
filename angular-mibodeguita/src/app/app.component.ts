import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

type Usuario = { id: number; nombre: string; email: string; rol: string; username?: string | null; telefono?: string | null; direccion?: string | null };
type NuevoUsuario = { nombre: string; username: string; email: string; password: string; telefono: string; direccion: string; rol: string };
type LoginResponse = { token: string; id: number; rol: string };
type Producto = { id: number; nombre: string; descripcion: string; imagen: string; precio: number; cantidad: number; stockMinimo: number | null; usuarioId: number | null };
type ProductoPayload = { nombre: string; descripcion: string; imagen: string; precio: number; cantidad: number; stockMinimo: number; usuarioId: number | null };

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], template: `
  <main class="page">
    <header class="hero"><div><p class="eyebrow">GESTIÓN DE BODEGAS</p><h1>MiBodeguita</h1><p>Administra tus productos e inventario desde un solo lugar.</p></div><span class="mark">MB</span></header>
    <section class="panel" *ngIf="!usuario">
      <h2>Iniciar sesión</h2><p class="muted">Ingresa con una cuenta registrada en la base de datos.</p>
      <form (ngSubmit)="login()" class="form-grid">
        <label>Correo electrónico<input type="email" name="email" [(ngModel)]="email" required email></label>
        <label>Contraseña<input type="password" name="password" [(ngModel)]="password" required minlength="1"></label>
        <button type="submit" [disabled]="cargando">{{ cargando ? 'Validando…' : 'Ingresar' }}</button>
      </form>
    </section>
    <ng-container *ngIf="usuario">
      <section class="welcome"><div><h2>Hola, {{ usuario.nombre }}</h2><p class="muted">Sesión iniciada como {{ usuario.rol }} · {{ usuario.email }}</p></div><button class="secondary" (click)="cerrarSesion()">Cerrar sesión</button></section>
<section class="dashboard" aria-label="Indicadores del inventario">
  <article class="metric-card">
    <div class="metric-icon metric-green">PR</div>
    <div>
      <p class="metric-label">Productos registrados</p>
      <p class="metric-value">{{ productos.length }}</p>
      <p class="metric-detail">Productos en el inventario</p>
    </div>
  </article>
  <article class="metric-card">
    <div class="metric-icon metric-blue">UN</div>
    <div>
      <p class="metric-label">Unidades disponibles</p>
      <p class="metric-value">{{ totalUnidades }}</p>
      <p class="metric-detail">Unidades en existencia</p>
    </div>
  </article>
  <article class="metric-card" [class.metric-warning]="totalProductosCriticos > 0">
    <div class="metric-icon metric-orange">!</div>
    <div>
      <p class="metric-label">Stock crítico</p>
      <p class="metric-value">{{ totalProductosCriticos }}</p>
      <p class="metric-detail">Productos por debajo de su stock mínimo</p>
    </div>
  </article>
</section>

      <section class="panel" *ngIf="esAdmin"><h2>{{ editandoId ? 'Editar producto' : 'Registrar producto' }}</h2>
        <form (ngSubmit)="guardarProducto()" class="form-grid product-form">
          <label>Nombre<input name="nombre" [(ngModel)]="form.nombre" required maxlength="120"></label>
          <label>Precio (S/)<input name="precio" type="number" [(ngModel)]="form.precio" min="0.01" step="0.01" required></label>
          <label>Stock<input name="cantidad" type="number" [(ngModel)]="form.cantidad" min="0" step="1" required></label>
          <label>Stock mínimo<input name="stockMinimo" type="number" [(ngModel)]="form.stockMinimo" min="0" step="1" required></label>
          <label>Imagen (nombre de archivo)<input name="imagen" [(ngModel)]="form.imagen" placeholder="default.jpg"></label>
          <label class="wide">Descripción<textarea name="descripcion" [(ngModel)]="form.descripcion" rows="2"></textarea></label>
          <div class="actions wide"><button type="submit" [disabled]="cargando">{{ editandoId ? 'Guardar cambios' : 'Registrar producto' }}</button><button type="button" class="secondary" *ngIf="editandoId" (click)="limpiarFormulario()">Cancelar edición</button></div>
        </form>
      </section>
      <section class="panel"><div class="list-heading"><div><h2>Inventario</h2><p class="muted">{{ productos.length }} producto(s) registrados</p></div><button class="secondary" (click)="cargarProductos()">Actualizar lista</button></div>
        <div class="stock-alert" *ngIf="productosCriticos.length > 0">
        <strong>⚠️ ¡Alerta de stock crítico!</strong>
        <p>
         Hay {{ productosCriticos.length }} producto(s) por debajo de su
        stock mínimo. Revisa el inventario y realiza el
        reabastecimiento necesario.
        </p>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Descripción</th><th>Acciones</th></tr></thead><tbody>
          <tr *ngFor="let p of productos"><td><strong>{{ p.nombre }}</strong><small>#{{ p.id }}</small></td><td>S/ {{ p.precio | number:'1.2-2' }}</td>
          <td>
        <span class="stock" [class.low-stock]="esCritico(p)">
         {{ p.cantidad }}
        </span>
        <span class="critical-label" *ngIf="esCritico(p)">
          ⚠ Stock crítico
        </span>
           </td>
          <td>{{ p.descripcion || '—' }}</td><td class="row-actions"><button class="small secondary" *ngIf="esAdmin" (click)="editar(p)">Editar</button><button class="small danger" *ngIf="esAdmin" (click)="eliminar(p)">Eliminar</button><button class="small info" (click)="abrirMovimiento(p)">Movimientos</button></td></tr>
          <tr *ngIf="productos.length === 0"><td colspan="5" class="empty">Todavía no hay productos registrados.</td></tr>
        </tbody></table></div>
        <div class="report-actions mt-3">
          <button type="button" class="btn btn-success" (click)="exportarA_Excel()">📊 Exportar a Excel</button>
          <button type="button" class="btn btn-info ms-2" (click)="exportarA_PDF()">📄 Exportar a PDF</button>
          <button type="button" class="btn btn-dark ms-2" (click)="exportarA_CSV()">📋 Exportar a CSV</button>
        </div>
      </section>
      <section class="panel" *ngIf="esAdmin"><div class="list-heading"><div><h2>Usuarios</h2><p class="muted">{{ usuarios.length }} usuario(s) registrados</p></div><button class="secondary" (click)="cargarUsuarios()">Actualizar lista</button></div>
        <form (ngSubmit)="crearUsuario()" class="form-grid" #formUsuario="ngForm">
          <label>Nombre<input name="usuarioNombre" [(ngModel)]="nuevoUsuario.nombre" required maxlength="120"></label>
          <label>Correo electrónico<input name="usuarioEmail" type="email" [(ngModel)]="nuevoUsuario.email" required email></label>
          <label>Contraseña<input name="usuarioPassword" type="password" [(ngModel)]="nuevoUsuario.password" required minlength="6" placeholder="Mínimo 6 caracteres"></label>
          <label>Rol<select name="usuarioRol" [(ngModel)]="nuevoUsuario.rol"><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select></label>
          <label>Usuario<input name="usuarioUsername" [(ngModel)]="nuevoUsuario.username"></label>
          <label>Teléfono<input name="usuarioTelefono" [(ngModel)]="nuevoUsuario.telefono"></label>
          <label class="wide">Dirección<input name="usuarioDireccion" [(ngModel)]="nuevoUsuario.direccion"></label>
          <div class="actions wide"><button type="submit" [disabled]="cargando || formUsuario.invalid">Crear usuario</button></div>
        </form>
        <div class="table-wrap users-table"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>
          <tr *ngFor="let u of usuarios"><td><strong>{{ u.nombre }}</strong><small>#{{ u.id }}{{ u.username ? ' · ' + u.username : '' }}</small></td><td>{{ u.email }}</td><td>{{ u.telefono || '—' }}</td>
          <td><span class="rol-badge" [class.rol-admin]="u.rol === 'ADMIN'">{{ u.rol }}</span></td>
          <td class="row-actions"><button class="small secondary" *ngIf="u.id !== usuario.id" (click)="cambiarRol(u)">{{ u.rol === 'ADMIN' ? 'Cambiar a USER' : 'Cambiar a ADMIN' }}</button><small *ngIf="u.id === usuario.id">Tu cuenta</small></td></tr>
          <tr *ngIf="usuarios.length === 0"><td colspan="5" class="empty">No hay usuarios para mostrar.</td></tr>
        </tbody></table></div>
      </section>
    </ng-container>
    <p class="notice" *ngIf="mensaje" [class.error]="esError">{{ mensaje }}</p>
    <footer>MiBodeguita · Aplicación académica de gestión de bodegas</footer>
  </main>
  ` })
export class AppComponent implements OnInit {
  private http = inject(HttpClient);

  private readonly apiGateway = 'http://localhost:8090';
  private readonly apiSecurity = `${this.apiGateway}/security-service/api/v1`;
  private readonly apiInventory = `${this.apiGateway}/inventory-service/api/v1`;
  private readonly apiMovement = `${this.apiGateway}/movement-service/api/v1`;

  usuario: Usuario | null = null;
  productos: Producto[] = [];
  usuarios: Usuario[] = [];
  nuevoUsuario: NuevoUsuario = this.usuarioVacio();
  readonly stockMinimo = 5;
  get esAdmin(): boolean {
    return this.usuario?.rol === 'ADMIN';
  }
  esCritico(producto: Producto): boolean {
    return producto.cantidad < (producto.stockMinimo ?? this.stockMinimo);
  }
  get productosCriticos(): Producto[] {
    return this.productos.filter(
        producto => this.esCritico(producto)
    );
  }
  get totalUnidades(): number {
    return this.productos.reduce(
        (total, producto) => total + (Number(producto.cantidad) || 0),
        0
    );
  }
  get totalProductosCriticos(): number {
    return this.productosCriticos.length;
  }
  email = ''; password = '';
  cargando = false; mensaje = ''; esError = false; editandoId: number | null = null;
  form: ProductoPayload = this.formularioVacio();

  ngOnInit(): void {
    const guardado = sessionStorage.getItem('mibodeguita.usuario');
    const token = sessionStorage.getItem('mibodeguita.token');
    if (guardado && token) { try { this.usuario = JSON.parse(guardado) as Usuario; void this.cargarProductos(); void this.cargarUsuarios(); } catch { this.borrarSesion(); } }
  }

  private usuarioVacio(): NuevoUsuario { return { nombre: '', username: '', email: '', password: '', telefono: '', direccion: '', rol: 'USER' }; }

  private formularioVacio(): ProductoPayload { return { nombre: '', descripcion: '', imagen: 'default.jpg', precio: 0.01, cantidad: 0, stockMinimo: this.stockMinimo, usuarioId: null }; }

  async login(): Promise<void> {
    this.limpiarMensaje(); this.cargando = true;
    try {
      const respuesta = await firstValueFrom(this.http.post<LoginResponse>(`${this.apiSecurity}/auth/login`, { email: this.email, password: this.password }));
      sessionStorage.setItem('mibodeguita.token', respuesta.token);
      this.usuario = await firstValueFrom(this.http.get<Usuario>(`${this.apiSecurity}/auth/me`));
      sessionStorage.setItem('mibodeguita.usuario', JSON.stringify(this.usuario));
      this.password = ''; this.mensaje = 'Sesión iniciada correctamente.'; await this.cargarProductos(); await this.cargarUsuarios();
    }
    catch (e) { this.borrarSesion(); this.mostrarError(e, 'No se pudo iniciar sesión. Verifica tus credenciales y que el backend esté activo.'); }
    finally { this.cargando = false; }
  }

  cerrarSesion(): void { this.usuario = null; this.productos = []; this.usuarios = []; this.nuevoUsuario = this.usuarioVacio(); this.borrarSesion(); this.limpiarFormulario(); this.mensaje = 'Sesión cerrada.'; this.esError = false; }

  private borrarSesion(): void { sessionStorage.removeItem('mibodeguita.usuario'); sessionStorage.removeItem('mibodeguita.token'); }

  async cargarProductos(): Promise<void> { this.limpiarMensaje(); try { this.productos = await firstValueFrom(this.http.get<Producto[]>(`${this.apiInventory}/productos`)); } catch (e) { this.mostrarError(e, 'No se pudo cargar el inventario. Comprueba la conexión con la API.'); } }

  async guardarProducto(): Promise<void> {
    this.limpiarMensaje(); this.cargando = true;

    const payload = {
      ...this.form,
      nombre: this.form.nombre.trim(),
      usuarioId: this.usuario?.id ?? null
    };
    try {
      if (this.editandoId) {
        await firstValueFrom(this.http.put<Producto>(`${this.apiInventory}/productos/${this.editandoId}`, payload));
        this.mensaje = 'Producto actualizado.';
      }
      else {
        await firstValueFrom(this.http.post<Producto>(`${this.apiInventory}/productos`, payload));
        this.mensaje = 'Producto registrado.';
      }
      this.esError = false;
      this.limpiarFormulario();
      await this.cargarProductos();
    } catch (e) {
      this.mostrarError(e, 'No se pudo guardar el producto. Revisa los campos y la API.');
    } finally {
      this.cargando = false; }
  }

  editar(p: Producto): void { this.editandoId = p.id; this.form = { nombre: p.nombre, descripcion: p.descripcion || '', imagen: p.imagen || 'default.jpg', precio: p.precio, cantidad: p.cantidad, stockMinimo: p.stockMinimo ?? this.stockMinimo, usuarioId: p.usuarioId }; window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async eliminar(p: Producto): Promise<void> {
    if (!confirm(`¿Deseas eliminar el producto "${p.nombre}"?`)) return;
    this.limpiarMensaje();
    try {
      await firstValueFrom(this.http.delete<void>(`${this.apiInventory}/productos/${p.id}`));
      this.mensaje = 'Producto eliminado.';
      this.esError = false;
      await this.cargarProductos();
    } catch (e) {
      this.mostrarError(e, 'No se pudo eliminar el producto.');
    }
  }

  async abrirMovimiento(producto: Producto): Promise<void> {
    const tipo = prompt(`Registrar movimiento para: ${producto.nombre}\nEscribe "ENTRADA" o "SALIDA":`)?.toUpperCase();
    if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') {
      if (tipo) alert('Tipo de movimiento inválido. Use ENTRADA o SALIDA.');
      return;
    }
    const cantidadStr = prompt('Ingresa la cantidad:');
    if (!cantidadStr) return;
    const cantidad = parseInt(cantidadStr, 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert('Cantidad inválida.');
      return;
    }
    const motivo = prompt('Ingresa el motivo del movimiento (Ej. Venta, Reabastecimiento):') || 'Ajuste';
    const usuarioId = this.usuario?.id ?? null;

    this.limpiarMensaje();
    try {
      await firstValueFrom(this.http.post<Producto>(`${this.apiInventory}/productos/${producto.id}/movimiento`, { tipo, cantidad, motivo, usuarioId }));
      this.mensaje = `Movimiento de ${tipo} registrado con éxito.`;
      await this.cargarProductos();
    } catch (e) {
      this.mostrarError(e, 'Error al registrar el movimiento.');
    }
  }
  async cargarUsuarios(): Promise<void> {
    if (!this.esAdmin) return;
    try { this.usuarios = await firstValueFrom(this.http.get<Usuario[]>(`${this.apiSecurity}/usuarios`)); }
    catch (e) { this.mostrarError(e, 'No se pudo cargar la lista de usuarios.'); }
  }

  async crearUsuario(): Promise<void> {
    this.limpiarMensaje(); this.cargando = true;
    const { rol, ...datos } = this.nuevoUsuario;
    const payload = {
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      password: datos.password,
      username: datos.username.trim() || null,
      telefono: datos.telefono.trim() || null,
      direccion: datos.direccion.trim() || null
    };
    try {
      const creado = await firstValueFrom(this.http.post<Usuario>(`${this.apiSecurity}/auth/register`, payload));
      if (rol === 'ADMIN') {
        await firstValueFrom(this.http.put<Usuario>(`${this.apiSecurity}/usuarios/${creado.id}/rol`, null, { params: { rol } }));
      }
      this.mensaje = `Usuario ${creado.email} creado como ${rol}.`;
      this.esError = false;
      this.nuevoUsuario = this.usuarioVacio();
      await this.cargarUsuarios();
    } catch (e) {
      this.mostrarError(e, 'No se pudo crear el usuario. Revisa los campos.');
    } finally {
      this.cargando = false;
    }
  }

  async cambiarRol(u: Usuario): Promise<void> {
    const nuevoRol = u.rol === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`¿Cambiar el rol de "${u.nombre}" a ${nuevoRol}?`)) return;
    this.limpiarMensaje();
    try {
      await firstValueFrom(this.http.put<Usuario>(`${this.apiSecurity}/usuarios/${u.id}/rol`, null, { params: { rol: nuevoRol } }));
      this.mensaje = `Rol de ${u.nombre} actualizado a ${nuevoRol}. El cambio aplica en su próximo inicio de sesión.`;
      this.esError = false;
      await this.cargarUsuarios();
    } catch (e) {
      this.mostrarError(e, 'No se pudo cambiar el rol.');
    }
  }

  async exportarA_Excel(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/reportes/exportar`, { responseType: 'blob' }));
      this.descargarArchivo(blob, 'inventario_mibodeguita.xlsx');
    } catch (e) { console.error('Error al descargar el Excel', e); }
  }

  async exportarA_PDF(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/reportes/exportar/pdf`, { responseType: 'blob' }));
      this.descargarArchivo(blob, 'inventario_mibodeguita.pdf');
    } catch (e) { console.error('Error al descargar el PDF', e); }
  }

  async exportarA_CSV(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/reportes/exportar/csv`, { responseType: 'blob' }));
      this.descargarArchivo(blob, 'inventario_mibodeguita.csv');
    } catch (e) { console.error('Error al descargar el CSV', e); }
  }

  private descargarArchivo(blob: Blob, nombre: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  limpiarFormulario(): void { this.editandoId = null; this.form = this.formularioVacio(); }
  private limpiarMensaje(): void { this.mensaje = ''; this.esError = false; }
  private mostrarError(e: unknown, fallback: string): void { this.esError = true; this.mensaje = e instanceof HttpErrorResponse ? ((e.error as { mensaje?: string; message?: string } | null)?.mensaje || (e.error as { message?: string } | null)?.message || fallback) : fallback; }
}

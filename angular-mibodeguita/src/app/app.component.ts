import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

type Usuario = { id: number; nombre: string; email: string; tipo: string };
type Producto = { id: number; nombre: string; descripcion: string; imagen: string; precio: number; cantidad: number; usuarioId: number | null };
type ProductoPayload = { nombre: string; descripcion: string; imagen: string; precio: number; cantidad: number; usuarioId: number | null };

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
      <section class="welcome"><div><h2>Hola, {{ usuario.nombre }}</h2><p class="muted">Sesión iniciada como {{ usuario.tipo }} · {{ usuario.email }}</p></div><button class="secondary" (click)="cerrarSesion()">Cerrar sesión</button></section>
      <section class="panel"><h2>{{ editandoId ? 'Editar producto' : 'Registrar producto' }}</h2>
        <form (ngSubmit)="guardarProducto()" class="form-grid product-form">
          <label>Nombre<input name="nombre" [(ngModel)]="form.nombre" required maxlength="120"></label>
          <label>Precio (S/)<input name="precio" type="number" [(ngModel)]="form.precio" min="0.01" step="0.01" required></label>
          <label>Stock<input name="cantidad" type="number" [(ngModel)]="form.cantidad" min="0" step="1" required></label>
          <label>Imagen (nombre de archivo)<input name="imagen" [(ngModel)]="form.imagen" placeholder="default.jpg"></label>
          <label class="wide">Descripción<textarea name="descripcion" [(ngModel)]="form.descripcion" rows="2"></textarea></label>
          <div class="actions wide"><button type="submit" [disabled]="cargando">{{ editandoId ? 'Guardar cambios' : 'Registrar producto' }}</button><button type="button" class="secondary" *ngIf="editandoId" (click)="limpiarFormulario()">Cancelar edición</button></div>
        </form>
      </section>
      <section class="panel"><div class="list-heading"><div><h2>Inventario</h2><p class="muted">{{ productos.length }} producto(s) registrados</p></div><button class="secondary" (click)="cargarProductos()">Actualizar lista</button></div>
        <div class="table-wrap"><table><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Descripción</th><th>Acciones</th></tr></thead><tbody>
          <tr *ngFor="let p of productos"><td><strong>{{ p.nombre }}</strong><small>#{{ p.id }}</small></td><td>S/ {{ p.precio | number:'1.2-2' }}</td><td><span class="stock" [class.low-stock]="p.cantidad < 5">{{ p.cantidad }}</span></td><td>{{ p.descripcion || '—' }}</td><td class="row-actions"><button class="small secondary" (click)="editar(p)">Editar</button><button class="small danger" (click)="eliminar(p)">Eliminar</button><button class="small info" (click)="abrirMovimiento(p)">Movimientos</button></td></tr>
          <tr *ngIf="productos.length === 0"><td colspan="5" class="empty">Todavía no hay productos registrados.</td></tr>
        </tbody></table></div>
        
        <!-- 📊 Botones de Reportería Multi-formato de Microservicios -->
        <div class="report-actions mt-3">
          <button type="button" class="btn btn-success" (click)="exportarA_Excel()">📊 Exportar a Excel</button>
          <button type="button" class="btn btn-info ms-2" (click)="exportarA_PDF()">📄 Exportar a PDF</button>
          <button type="button" class="btn btn-dark ms-2" (click)="exportarA_CSV()">📋 Exportar a CSV</button>
        </div>
      </section>
    </ng-container>
    <p class="notice" *ngIf="mensaje" [class.error]="esError">{{ mensaje }}</p>
    <footer>MiBodeguita · Aplicación académica de gestión de bodegas</footer>
  </main>
  ` })
export class AppComponent implements OnInit {
  private http = inject(HttpClient);

  // ⚙️ URLs de los Microservicios distribuidos
  private readonly apiSecurity = 'http://localhost:8070/api';
  private readonly apiInventory = 'http://localhost:8070/api';
  private readonly apiMovement = 'http://localhost:8070/api';

  usuario: Usuario | null = null;
  productos: Producto[] = [];
  email = ''; password = '';
  cargando = false; mensaje = ''; esError = false; editandoId: number | null = null;
  form: ProductoPayload = this.formularioVacio();

  ngOnInit(): void {
    const guardado = sessionStorage.getItem('mibodeguita.usuario');
    if (guardado) { try { this.usuario = JSON.parse(guardado) as Usuario; void this.cargarProductos(); } catch { sessionStorage.removeItem('mibodeguita.usuario'); } }
  }

  private formularioVacio(): ProductoPayload { return { nombre: '', descripcion: '', imagen: 'default.jpg', precio: 0.01, cantidad: 0, usuarioId: null }; }

  // 🔐 Login -> security-service (:8081)
  async login(): Promise<void> {
    this.limpiarMensaje(); this.cargando = true;
    try { this.usuario = await firstValueFrom(this.http.post<Usuario>(`${this.apiSecurity}/auth/login`, { email: this.email, password: this.password })); sessionStorage.setItem('mibodeguita.usuario', JSON.stringify(this.usuario)); this.password = ''; this.mensaje = 'Sesión iniciada correctamente.'; await this.cargarProductos(); }
    catch (e) { this.mostrarError(e, 'No se pudo iniciar sesión. Verifica tus credenciales y que el backend esté activo.'); }
    finally { this.cargando = false; }
  }

  cerrarSesion(): void { this.usuario = null; this.productos = []; sessionStorage.removeItem('mibodeguita.usuario'); this.limpiarFormulario(); this.mensaje = 'Sesión cerrada.'; this.esError = false; }

  // 📦 Listar -> inventory-service (:8082)
  async cargarProductos(): Promise<void> { this.limpiarMensaje(); try { this.productos = await firstValueFrom(this.http.get<Producto[]>(`${this.apiInventory}/productos`)); } catch (e) { this.mostrarError(e, 'No se pudo cargar el inventario. Comprueba la conexión con la API.'); } }

  // 📦 Guardar/Actualizar -> inventory-service (:8082)
  async guardarProducto(): Promise<void> {
    this.limpiarMensaje(); this.cargando = true;

    // ⚙️ Aseguramos que viaje la propiedad stockMinimo con un valor por defecto
    const payload = {
      ...this.form,
      nombre: this.form.nombre.trim(),
      usuarioId: this.usuario?.id ?? null,
      stockMinimo: 5 // 👈 AGREGA ESTA LÍNEA AQUÍ
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

  editar(p: Producto): void { this.editandoId = p.id; this.form = { nombre: p.nombre, descripcion: p.descripcion || '', imagen: p.imagen || 'default.jpg', precio: p.precio, cantidad: p.cantidad, usuarioId: p.usuarioId }; window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // 📦 Eliminar -> inventory-service (:8082)
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

  // 🔄 Registrar Movimiento -> movement-service (:8083)
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
      await firstValueFrom(this.http.post<Producto>(`${this.apiMovement}/productos/${producto.id}/movimiento`, null, {
        params: { tipo, cantidad, motivo, ...(usuarioId ? { usuarioId } : {}) }
      }));
      this.mensaje = `Movimiento de ${tipo} registrado con éxito.`;
      await this.cargarProductos();
    } catch (e) {
      this.mostrarError(e, 'Error al registrar el movimiento.');
    }
  }
  // 📊 Excel -> movement-service (:8083)
  async exportarA_Excel(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/productos/exportar`, { responseType: 'blob' }));
      this.descargarArchivo(blob, 'inventario_mibodeguita.xlsx');
    } catch (e) { console.error('Error al descargar el Excel', e); }
  }

  // 📄 PDF -> movement-service (:8083)
  async exportarA_PDF(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/productos/exportar/pdf`, { responseType: 'blob' }));
      this.descargarArchivo(blob, 'inventario_mibodeguita.pdf');
    } catch (e) { console.error('Error al descargar el PDF', e); }
  }

  // 📋 CSV -> movement-service (:8083)
  async exportarA_CSV(): Promise<void> {
    try {
      const blob = await firstValueFrom(this.http.get(`${this.apiMovement}/productos/exportar/csv`, { responseType: 'blob' }));
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
  private mostrarError(e: unknown, fallback: string): void { this.esError = true; this.mensaje = e instanceof HttpErrorResponse ? ((e.error as { mensaje?: string } | null)?.mensaje || fallback) : fallback; }
}

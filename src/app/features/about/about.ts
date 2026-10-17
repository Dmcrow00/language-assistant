import { Component, inject } from '@angular/core';
import { version } from '../../../../package.json';
import { FoneticaApiService } from '../../core/fonetica-api.service';

/** Acerca de la app: para qué es, de dónde salen los datos y los créditos. */
@Component({
  selector: 'app-about',
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  protected readonly api = inject(FoneticaApiService);
  protected readonly version = version;
}

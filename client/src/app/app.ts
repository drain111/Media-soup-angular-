import { Component, HostListener, Injectable, PLATFORM_ID, TransferState, inject, makeStateKey, signal } from '@angular/core';
import { isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, finalize, of, tap } from 'rxjs';
import { RouterOutlet } from '@angular/router';




@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  
}
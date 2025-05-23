import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListenerComponent } from './listener.component';

describe('ListenerComponent', () => {
  let component: ListenerComponent;
  let fixture: ComponentFixture<ListenerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListenerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListenerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

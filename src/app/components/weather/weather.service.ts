import { Injectable } from '@angular/core';
import { Http, Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import 'rxjs/Rx';
import 'rxjs/add/operator/catch';

import { AppService } from '../../app.service';
import { LoaderService } from '../../components/loader/loader.service';
import { HelperService } from '../../_services/helper.service';
import { WeatherIconsService } from '../../_services/weather-icons.service';

import { Weather } from './weather';
import { apiConfig, appConfig } from '../../config';
import * as wiDataByCode from '../../data/wi-codes.data.json';

@Injectable()
export class WeatherService {
  private unitSystem: string;
  private weather: Subject<Weather> = new Subject<Weather>();
  private subscribers: any = {};
  private wiDataByCode: any;
  private weatherUpdateInterval: number = 300000; // 300000 = 5 minutes

  constructor(
    private http: Http,
    private appService: AppService,
    private loaderService: LoaderService,
    private helperService: HelperService,
    private weatherIconsService: WeatherIconsService,
  ) {
    this.unitSystem = appService.getUnitSystem();
    this.wiDataByCode = wiDataByCode;
  }

  getWeather(): Subject<Weather> {
    return this.weather;
  }

  getWeatherByСurrentLocation(): Promise<any> {
    this.showLoader();
    if (this.subscribers.city) this.subscribers.city.unsubscribe(); // TODO: I think, It shouldn't be so

    return new Promise((resolve, reject) => {
      window.navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;

        this.subscribers.city = this.getWeatherByLocation(latitude, longitude).subscribe((weather) => {
          resolve(weather.city);

          this.hideLoader();
        });
      }, (error) => {
        if (error.code === 1) { // if user didn't approve geolocation
          this.subscribers.city = this.getWeatherByLocation(
            appConfig.defaultCity.coord.latitude,
            appConfig.defaultCity.coord.longitude
          ).subscribe((weather) => {
            resolve(weather.city);

            this.hideLoader();
          });
        } else {
          console.error(error);
          this.hideLoader();
        }
      });
    })
  }

  createResponseWeatherByCity(city: string): Promise<any> { // TODO: I think, It shouldn't be so
    this.showLoader();
    if (this.subscribers.city) this.subscribers.city.unsubscribe(); // TODO: I think, It shouldn't be so


    return new Promise((resolve, reject) => {
      this.subscribers.city = this.getWeatherByCity(city).subscribe((weather) => {
        resolve(weather);

        this.hideLoader();
      }, (error) => {
        reject(error);
        this.hideLoader();
      })
    })
  }

  getWeatherByLocation(latitude: number, longitude: number): Observable<any> {
    return Observable.interval(this.weatherUpdateInterval).startWith(0)
      .switchMap(() =>
        this.http.get(`${apiConfig.host}/weather?appid=${apiConfig.appid}&lat=${latitude}&lon=${longitude}&units=${this.unitSystem}`)
          .map((response: Response) => response.json())
          .map((data) => {
            const weather = this.handleResponseWeatherData(data);

            this.weather.next(weather);
            return weather;
          })
          .catch(this.handleError)
      );
  }

  getWeatherByCity(city: string): Observable<any> {
     return Observable.interval(this.weatherUpdateInterval).startWith(0)
      .switchMap(() => {
        return this.http.get(`${apiConfig.host}/weather?appid=${apiConfig.appid}&q=${city}&units=${this.unitSystem}`)
          .map((response: Response) => response.json())
          .map((data) => {
            const weather = this.handleResponseWeatherData(data);

            this.weather.next(weather);
            return weather;
          })
          .catch(this.handleError)
      }
      );
  }

  private handleResponseWeatherData(responseData: any): Weather {
    const { name, main, weather, wind, sys } = responseData;

    const updateAt = new Date().getTime();
    const iconClassname = this.weatherIconsService.getIconClassNameByCode(weather[0].id, sys.sunset);
    const temperature = Math.round(main.temp);
    const pressureInHpa = Math.round(main.pressure);
    const pressureInMmHg = (this.unitSystem === appConfig.defaultUnit) ? this.helperService.getPressureInMmHg(pressureInHpa) : pressureInHpa;
    const windDegrees = Math.round(wind.deg);
    const windDirection = this.helperService.getWindDirection(windDegrees);
    const windBeaufortScale = this.helperService.getWindBeaufortScaleByMeterInSecond(wind.speed);
    const sunriseTime = sys.sunrise * 1000;
    const sunsetTime = sys.sunset * 1000;

    return new Weather(
      updateAt,
      name,
      iconClassname,
      temperature,
      main.humidity,
      pressureInHpa,
      pressureInMmHg,
      weather[0].description,
      sunriseTime,
      sunsetTime,
      windDirection,
      wind.speed,
      windBeaufortScale
    );
  }

  private handleError(error: any): Observable<any> {
    return Observable.throw(error.message || error)
  }

  private showLoader(): void {
    this.loaderService.show();
  }

  private hideLoader(): void {
    this.loaderService.hide();
  }
}
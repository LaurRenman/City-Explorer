# TourGuide v1.0

The aim of this project was to allow users to explore any city in the world by providing suggestions of popular tourist spots and calculating the best route between them

## Features 

**AI recommendations**   - discover the most popular tourist spots for a given city

**Optimized Routes**     - get the best route between sites

**Transport options**    - compare between transportation options

**Site selection**       - choose the sites you want to visit

**Filtered queries**     - filter the sites by category

**Language support**     - support for 3 languages (english, french, romanian)



## Set-up 
**1.** Download and install the Anaconda Distribution : https://www.anaconda.com/download

**2.** Extract the files from tourguide.zip and navigate to the *tourguide* folder. Make sure the folders are structured as following :
```bash
├── tourguide
│   ├── config
│   ├── modules
│   │   ├── API_Tourist_Sites.py
│   ├── static
│   ├── templates
│   ├── venv
│   ├── app.py
│   ├── README.md
│   ├── requirements.txt
```
**3.** Edit *API_Tourist_Sites.py* and replace *!key* by your API key in line 13 (check **API key** for more information on how to get your key)
```bash
DEFAULT_API_KEY = " !key "
```
**4.** Open *Anaconda Prompt* and navigate to the tourguide folder using *cd*
```bash
cd C:\Users\S\Documents\tourguide\tourguide
```
**5.**  Install the required packages
```bash
pip install -r requirements.txt
```
**6.** Launch the app 
```bash
python app.py
```
**7.** Open your navigator and connect to the designated address
```bash
 * Running on http://127.0.0.1:5000
```

*Note* 

During testing we encountered some bugs related to old versions of the packages used. Make sure the latest packages are installed using this command (here for the *Flask* package) :
```bash
 pip install --upgrade flask
```

## API key 
This app requires an API key for Groq in order to send requests to the website 

**1.** Go to *https://console.groq.com/home* and create an account/log-in

**2.** Navigate to the *API keys* tab and select **Create API key**

**3.** Copy your key and replace it in the *API_Tourist_Sites.py* file

*Note* 

A new API key has to be generated every once in a while as the number of API calls per key is limited. If no results come up when searching for a city, try creating a new API key and repeating the steps above.

